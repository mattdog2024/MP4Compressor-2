const { exec } = require('child_process');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * 检测系统GPU并返回FFmpeg支持的编码器
 */
async function detectGPUCapabilities() {
    // 打包后用 process.resourcesPath，开发环境用相对路径
    const ffmpegPath = process.resourcesPath
        ? path.join(process.resourcesPath, 'ffmpeg.exe')
        : path.join(__dirname, '../../resources/ffmpeg.exe');

    try {
        // 获取FFmpeg支持的编码器
        const { stdout } = await execPromise(`"${ffmpegPath}" -encoders`);

        const encoders = stdout;

        // 检测GPU编码器支持情况
        const hasNVENC = encoders.includes('h264_nvenc');
        const hasQSV = encoders.includes('h264_qsv');
        const hasAMF = encoders.includes('h264_amf');

        // 获取系统GPU信息（Windows）
        const gpuInfo = await getWindowsGPUInfo();

        return {
            hasNVENC,
            hasQSV,
            hasAMF,
            gpuInfo,
            recommendedEncoder: selectRecommendedEncoder(hasNVENC, hasQSV, hasAMF)
        };
    } catch (error) {
        console.error('GPU检测失败:', error);
        return {
            hasNVENC: false,
            hasQSV: false,
            hasAMF: false,
            gpuInfo: '未知',
            recommendedEncoder: 'libx264'
        };
    }
}

/**
 * 获取Windows系统GPU信息
 */
async function getWindowsGPUInfo() {
    try {
        // 使用 PowerShell 获取 GPU 信息，强制 UTF-8 输出
        const { stdout } = await execPromise(
            'powershell -NoProfile -OutputFormat Text -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; (Get-WmiObject Win32_VideoController | Where-Object {$_.Name -match \'NVIDIA|AMD|Radeon|GeForce|Intel.*Graphics|RTX|GTX\'}).Name -join \'||\' "',
            { encoding: 'utf8' }
        );
        const names = stdout.trim().split('||').map(s => s.trim()).filter(Boolean);
        if (names.length > 0) return names.join(', ');

        // 如果没有匹配到主流显卡，返回第一个非虚拟设备
        const { stdout: all } = await execPromise(
            'powershell -NoProfile -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; (Get-WmiObject Win32_VideoController | Where-Object {$_.Name -notmatch \'Mirror|Remote|Virtual|Radmin|Oray\'}).Name -join \'||\' "',
            { encoding: 'utf8' }
        );
        const filtered = all.trim().split('||').map(s => s.trim()).filter(s => /^[\x20-\x7E]+$/.test(s));
        return filtered.join(', ') || 'GPU';
    } catch {
        return 'GPU';
    }
}

/**
 * 选择推荐的编码器
 */
function selectRecommendedEncoder(hasNVENC, hasQSV, hasAMF) {
    if (hasNVENC) return 'h264_nvenc';
    if (hasQSV) return 'h264_qsv';
    if (hasAMF) return 'h264_amf';
    return 'libx264';
}

/**
 * 获取GPU显示名称
 */
function getGPUDisplayName(capabilities) {
    if (capabilities.hasNVENC) {
        return `GPU加速 (NVIDIA - ${capabilities.gpuInfo})`;
    } else if (capabilities.hasQSV) {
        return `GPU加速 (Intel Quick Sync - ${capabilities.gpuInfo})`;
    } else if (capabilities.hasAMF) {
        return `GPU加速 (AMD - ${capabilities.gpuInfo})`;
    } else {
        return 'CPU 模式';
    }
}

module.exports = {
    detectGPUCapabilities,
    getGPUDisplayName
};
