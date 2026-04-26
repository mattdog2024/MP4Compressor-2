const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

/**
 * 获取 FFprobe 路径
 */
function getFFprobePath() {
    if (process.resourcesPath) {
        // 打包后：extraResources 直接放在 process.resourcesPath 根目录
        return path.join(process.resourcesPath, 'ffprobe.exe');
    }
    // 开发环境
    return path.join(__dirname, '../../resources/ffprobe.exe');
}

/**
 * 获取视频文件信息
 */
function getVideoInfo(filePath) {
    return new Promise((resolve, reject) => {
        // 必须设置 ffprobe 路径，否则会使用系统 PATH 中的版本（可能不存在）
        ffmpeg.setFfprobePath(getFFprobePath());

        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
            const subtitleStreams = metadata.streams.filter(s => s.codec_type === 'subtitle');

            const info = {
                duration: metadata.format.duration || 0,
                width: videoStream ? videoStream.width : 0,
                height: videoStream ? videoStream.height : 0,
                codec: videoStream ? videoStream.codec_name : 'unknown',
                bitrate: parseInt(metadata.format.bit_rate) || 0,
                size: parseInt(metadata.format.size) || 0,
                hasAudio: !!audioStream,
                hasSubtitles: subtitleStreams.length > 0,
                subtitleCount: subtitleStreams.length,
                subtitles: subtitleStreams.map((sub, index) => ({
                    index: index,
                    codec: sub.codec_name,
                    title: sub.tags ? sub.tags.title || `字幕${index + 1}` : `字幕${index + 1}`,
                    language: sub.tags ? sub.tags.language || 'unknown' : 'unknown'
                }))
            };

            resolve(info);
        });
    });
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * 格式化时长
 */
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

module.exports = {
    getVideoInfo,
    formatFileSize,
    formatDuration
};
