const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

/**
 * 获取 FFmpeg / FFprobe 路径
 */
function getFFmpegPaths() {
    if (process.resourcesPath) {
        // 打包后：extraResources 直接放在 process.resourcesPath 根目录
        return {
            ffmpegPath: path.join(process.resourcesPath, 'ffmpeg.exe'),
            ffprobePath: path.join(process.resourcesPath, 'ffprobe.exe')
        };
    }
    // 开发环境
    return {
        ffmpegPath: path.join(__dirname, '../../resources/ffmpeg.exe'),
        ffprobePath: path.join(__dirname, '../../resources/ffprobe.exe')
    };
}

/**
 * 判断字幕路径是否有效（非空、非空字符串、文件存在）
 */
function isValidSubtitlePath(p) {
    if (!p || typeof p !== 'string' || p.trim() === '') return false;
    try {
        return fs.existsSync(p);
    } catch (e) {
        return false;
    }
}

/**
 * 把 libx264 的 CRF 值映射到 GPU 编码器对应的质量参数
 * 
 * libx264 CRF 范围：0（无损）~ 51（最差），默认 23，越大越小
 * h264_nvenc CQ  范围：0（最好）~ 51（最差），越大越小（和 CRF 含义相同）
 * h264_qsv  global_quality：1（最好）~ 51（最差）
 * h264_amf  qp_i/qp_p：0（最好）~ 51（最差）
 * 
 * 所以三者的数值含义基本一致，可以直接使用同一个 CRF 值。
 * 但 nvenc 的 -cq 默认值是 0（自动），需要显式设置才有效。
 */
function buildFFmpegCommand(inputPath, outputPath, options) {
    const {
        width = -1,
        height = -2,
        crf = 26,
        preset = 'veryfast',
        volume = 1.0,
        skipStart = 0,
        skipEnd = 0,
        subtitlePath = null,       // 外部字幕文件路径（备用）
        subtitleStreamIndex = -1,  // MKV 内置字幕流索引（-1 表示不烧录）
        encoder = 'libx264'
    } = options;

    const { ffmpegPath, ffprobePath } = getFFmpegPaths();

    let command = ffmpeg(inputPath);
    command.setFfmpegPath(ffmpegPath);
    command.setFfprobePath(ffprobePath);

    // 跳过片头：从第 skipStart 秒开始（放在输入前，速度更快）
    if (skipStart > 0) {
        command.inputOptions(['-ss', String(skipStart)]);
    }

    // 忽略未知数据流（防止特殊编码的视频崩溃）
    command.inputOptions(['-ignore_unknown']);

    // 视频滤镜
    const videoFilters = [];

    // 分辨率缩放（-1 表示保持原始）
    if (width && width > 0) {
        // force_original_aspect_ratio=decrease 确保只缩小不放大
        videoFilters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
    }

    // 烧录内置字幕（MKV 内置字幕流）
    // subtitleStreamIndex >= 0 才烧录，-1 表示不烧录
    if (typeof subtitleStreamIndex === 'number' && subtitleStreamIndex >= 0) {
        const safePath = inputPath.replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, '\\:');
        videoFilters.push(`subtitles='${safePath}':si=${subtitleStreamIndex}`);
    } else if (isValidSubtitlePath(subtitlePath)) {
        // 外部字幕文件：必须是真实存在的文件才烧录
        const safePath = subtitlePath.replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, '\\:');
        const externalSi = (typeof options.externalSubtitleStreamIndex === 'number' && options.externalSubtitleStreamIndex >= 0)
            ? options.externalSubtitleStreamIndex : 0;
        videoFilters.push(`subtitles='${safePath}':si=${externalSi}`);
    }
    // 其他情况（subtitlePath 为 null/空字符串/undefined）：不添加字幕滤镜，正常压缩

    if (videoFilters.length > 0) {
        command.videoFilters(videoFilters.join(','));
    }

    // 视频编码器
    // 注意：nvenc/qsv/amf 的质量参数和 libx264 的 CRF 含义相同（数值越大质量越低文件越小）
    if (encoder === 'h264_nvenc') {
        command.videoCodec('h264_nvenc');
        // -cq 控制质量（等同于 CRF），-rc vbr 启用可变码率模式
        // 不设置 -b:v 0 会导致 nvenc 忽略 -cq 参数，文件反而变大
        command.outputOptions([
            '-rc', 'vbr',
            '-cq', String(crf),
            '-b:v', '0',
            '-maxrate', `${Math.round(8000 * (51 - crf) / 28)}k`,
            '-bufsize', `${Math.round(16000 * (51 - crf) / 28)}k`,
            '-preset', 'fast'
        ]);
    } else if (encoder === 'h264_qsv') {
        command.videoCodec('h264_qsv');
        command.outputOptions(['-global_quality', String(crf), '-look_ahead', '1']);
    } else if (encoder === 'h264_amf') {
        command.videoCodec('h264_amf');
        command.outputOptions([
            '-quality', 'speed',
            '-rc', 'cqp',
            '-qp_i', String(crf),
            '-qp_p', String(crf),
            '-qp_b', String(Math.min(51, crf + 2))
        ]);
    } else {
        // CPU 模式 libx264
        command.videoCodec('libx264');
        command.outputOptions(['-crf', String(crf), '-preset', preset]);
    }

    // 音频处理
    // 先尝试直接复制音频流（速度快，不损失质量）
    // 如果音频格式不兼容 MP4 容器（如 EAC3、DTS、FLAC），则重新编码为 AAC
    if (volume !== 1.0) {
        // 需要调整音量，必须重新编码
        command.audioFilters(`volume=${volume}`);
        command.audioCodec('aac');
        command.audioBitrate('192k');
    } else {
        // 不需要调整音量，尝试直接复制；如果格式不兼容则自动转 AAC
        // 用 -c:a copy 先尝试，不兼容时 ffmpeg 会报错
        // 为了兼容性，直接转 AAC（速度也很快）
        command.audioCodec('aac');
        command.audioBitrate('192k');
    }

    // 输出选项
    command.outputOptions([
        '-movflags', '+faststart',
        '-map_metadata', '-1',  // 去掉元数据，减小文件体积
        '-map', '0:v:0',        // 只取第一条视频流
        '-map', '0:a?',         // 取所有音频流（? 表示没有时不报错）
    ]);
    command.output(outputPath);

    return command;
}

/**
 * 执行压缩任务
 * @param {string} inputPath 输入文件路径
 * @param {string} outputPath 输出文件路径
 * @param {object} options 压缩选项
 * @param {function} onProgress 进度回调
 * @param {function} onCommandReady 命令就绪回调（用于保存引用以支持停止）
 */
function compressVideo(inputPath, outputPath, options, onProgress, onCommandReady) {
    const { skipStart = 0, skipEnd = 0 } = options;
    return new Promise((resolve, reject) => {
        // 如果需要跳过片尾，先获取视频总时长
        if (skipEnd > 0) {
            const { ffprobePath } = getFFmpegPaths();
            const ffmpegLib = require('fluent-ffmpeg');
            ffmpegLib.setFfprobePath(ffprobePath);
            ffmpegLib.ffprobe(inputPath, (err, metadata) => {
                if (err) {
                    // 获取时长失败，忽略片尾跳过，继续执行
                    runCommand(null);
                } else {
                    const duration = metadata.format.duration || 0;
                    // 结束时间点 = 总时长 - 跳过片尾 - 片头偏移
                    const endTime = Math.max(0, duration - skipEnd - skipStart);
                    runCommand(endTime);
                }
            });
        } else {
            runCommand(null);
        }

        function runCommand(endTime, overrideOptions, isGpuRetry) {
            // 如果是 GPU 降级重试，使用覆盖的 options
            if (overrideOptions) options = overrideOptions;
            isGpuRetry = isGpuRetry || false;
            const command = buildFFmpegCommand(inputPath, outputPath, options);
            // 设置结束时间点（跳过片尾）
            if (endTime !== null && endTime > 0) {
                command.outputOptions(['-t', String(endTime)]);
            }
            // 通知外部保存命令引用
            if (onCommandReady) {
                onCommandReady(command);
            }

            // 收集 stderr 输出（ffmpeg 的详细日志）
            const stderrLines = [];
            command.on('stderr', (line) => {
                stderrLines.push(line);
            });

            command.on('progress', (progress) => {
                if (onProgress) {
                    onProgress(progress);
                }
            });
            command.on('end', () => {
                // 写入成功日志
                try {
                    const logPath = path.join(require('os').homedir(), 'ffmpeg-debug.log');
                    const logContent = `[${new Date().toISOString()}] SUCCESS\nInput: ${inputPath}\nOutput: ${outputPath}\n\n`;
                    fs.appendFileSync(logPath, logContent);
                } catch (e) {}
                resolve({ success: true, outputPath });
            });
            command.on('error', (err) => {
                // 被手动停止时不视为错误
                if (err.message && (err.message.includes('SIGKILL') || err.message.includes('ffmpeg was killed') || err.message.includes('SIGTERM') || err.message.includes('killed') || err.message.includes('exited with code null'))) {
                    resolve({ success: false, stopped: true });
                    return;
                }
                // 取最后 30 行 stderr（最关键的错误信息在末尾）
                const stderrTail = stderrLines.slice(-30).join('\n');
                // 写入详细错误日志
                try {
                    const logPath = path.join(require('os').homedir(), 'ffmpeg-debug.log');
                    const logContent = [
                        `[${new Date().toISOString()}] ${isGpuRetry ? 'ERROR(CPU)' : 'ERROR(GPU->CPU fallback?)'}`,
                        `Input: ${inputPath}`,
                        `Output: ${outputPath}`,
                        `Error: ${err.message}`,
                        `--- FFmpeg stderr (last 30 lines) ---`,
                        stderrTail,
                        `--- end ---`,
                        ''
                    ].join('\n');
                    fs.appendFileSync(logPath, logContent + '\n');
                } catch (e) {}

                // ★ GPU 降级逻辑：如果是 GPU 编码器失败，自动用 CPU 重试
                const isGpuError = stderrTail.includes('nvenc') || stderrTail.includes('amf') ||
                    stderrTail.includes('qsv') || stderrTail.includes('h264_nvenc') ||
                    stderrTail.includes('hevc_nvenc') || stderrTail.includes('Driver does not support') ||
                    stderrTail.includes('nvenc API version') || stderrTail.includes('Error while opening encoder');
                if (isGpuError && !isGpuRetry) {
                    // 记录降级日志
                    try {
                        const logPath = path.join(require('os').homedir(), 'ffmpeg-debug.log');
                        fs.appendFileSync(logPath, `[${new Date().toISOString()}] GPU failed, retrying with CPU (libx264)\n\n`);
                    } catch (e) {}
                    // 删除可能已生成的空输出文件
                    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) {}
                    // 用 CPU 重试
                    const cpuOptions = Object.assign({}, options, { encoder: 'libx264' });
                    runCommand(endTime, cpuOptions, true);
                    return;
                }

                // 把 stderr 附加到错误消息里，方便界面显示
                const detailedError = new Error(
                    `ffmpeg error: ${err.message}\n\n--- FFmpeg 详细错误 ---\n${stderrTail}`
                );
                reject(detailedError);
            });
            command.run();
        }
    });
}

/**
 * 强制停止一个 FFmpeg 任务
 */
function killTask(command) {
    if (command && typeof command.kill === 'function') {
        command.kill('SIGKILL');
    }
}

/**
 * 生成输出文件路径
 */
function generateOutputPath(inputPath, outputDir) {
    const ext = path.extname(inputPath);
    const fileName = path.basename(inputPath, ext);
    const outputFileName = `${fileName}_compressed.mp4`;
    if (outputDir) {
        return path.join(outputDir, outputFileName);
    } else {
        const inputDir = path.dirname(inputPath);
        return path.join(inputDir, outputFileName);
    }
}

module.exports = {
    buildFFmpegCommand,
    compressVideo,
    generateOutputPath,
    killTask
};
