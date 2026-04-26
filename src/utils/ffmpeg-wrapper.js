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
 * 构建 FFmpeg 命令
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

    // 跳过片头：从第 skipStart 秒开始
    if (skipStart > 0) {
        command.inputOptions(['-ss', String(skipStart)]);
    }

    // 跳过片尾：需要知道视频总时长，用 -to 指定结束时间点
    // 用 duration 属性先记录，在 compressVideo 中处理
    if (skipEnd > 0) {
        // 标记需要跳过的片尾秒数，在 compressVideo 中动态计算
        command._skipEnd = skipEnd;
    }

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
    if (encoder === 'h264_nvenc') {
        command.videoCodec('h264_nvenc');
        command.outputOptions(['-cq', String(crf), '-preset', 'fast']);
    } else if (encoder === 'h264_qsv') {
        command.videoCodec('h264_qsv');
        command.outputOptions(['-global_quality', String(crf), '-preset', 'medium']);
    } else if (encoder === 'h264_amf') {
        command.videoCodec('h264_amf');
        command.outputOptions(['-quality', 'speed', '-rc', 'cqp', '-qp_i', String(crf), '-qp_p', String(crf)]);
    } else {
        // CPU 模式 libx264
        command.videoCodec('libx264');
        command.outputOptions(['-crf', String(crf), '-preset', preset]);
    }

    // 音频处理
    if (volume !== 1.0) {
        command.audioFilters(`volume=${volume}`);
    }
    command.audioCodec('aac');
    command.audioBitrate('128k');

    // 输出选项
    command.outputOptions(['-movflags', '+faststart']);
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

        function runCommand(duration) {
            const command = buildFFmpegCommand(inputPath, outputPath, options);
            // 设置输出时长（跳过片尾）
            if (duration !== null && duration > 0) {
                command.outputOptions(['-t', String(duration)]);
            }
            // 通知外部保存命令引用
            if (onCommandReady) {
                onCommandReady(command);
            }
            command.on('progress', (progress) => {
                if (onProgress) {
                    onProgress(progress);
                }
            });
            command.on('end', () => {
                resolve({ success: true, outputPath });
            });
            command.on('error', (err) => {
                // 被手动停止时不视为错误
                if (err.message && (err.message.includes('SIGKILL') || err.message.includes('ffmpeg was killed'))) {
                    resolve({ success: false, stopped: true });
                } else {
                    reject(err);
                }
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
    const outputFileName = `${fileName}_compressed${ext || '.mp4'}`;
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
