const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { detectGPUCapabilities, getGPUDisplayName } = require('./src/utils/gpu-detector');
const { getVideoInfo } = require('./src/utils/video-info');
const { compressVideo, generateOutputPath, killTask } = require('./src/utils/ffmpeg-wrapper');

let mainWindow;
let gpuCapabilities = null;

// 活跃的压缩任务 Map (id -> ffmpeg command)
const activeTasks = new Map();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 960,
        height: 640,
        minWidth: 800,
        minHeight: 560,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        backgroundColor: '#f9fafb',
        title: '视频压缩器',
        // 移除菜单栏
        autoHideMenuBar: true,
    });

    mainWindow.loadFile('public/index.html');

    // 生产模式不打开开发者工具
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
    createWindow();
    // GPU检测（异步，失败不影响应用启动）
    try {
        gpuCapabilities = await detectGPUCapabilities();
    } catch (error) {
        console.error('GPU检测失败，使用CPU模式:', error);
        gpuCapabilities = {
            hasNVENC: false,
            hasQSV: false,
            hasAMF: false,
            gpuInfo: '未知',
            recommendedEncoder: 'libx264'
        };
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// ==================== IPC 处理 ====================

// 选择视频文件
ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: '视频文件', extensions: ['mkv', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'] },
            { name: '所有文件', extensions: ['*'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths;
    }
    return [];
});

// 选择文件夹并返回其中的视频文件
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// 获取文件夹中的视频文件列表
ipcMain.handle('get-files-in-folder', async (event, folderPath) => {
    const videoExts = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    try {
        const entries = fs.readdirSync(folderPath);
        const videoFiles = entries
            .filter(name => {
                const ext = path.extname(name).toLowerCase();
                return videoExts.includes(ext);
            })
            .map(name => path.join(folderPath, name));
        return videoFiles;
    } catch (error) {
        console.error('读取文件夹失败:', error);
        return [];
    }
});

// 选择输出目录
ipcMain.handle('select-output-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// 选择外挂字幕文件
ipcMain.handle('select-external-subtitle', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: '字幕文件', extensions: ['srt', 'ass', 'ssa', 'sub', 'vtt'] },
            { name: '所有文件', extensions: ['*'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// GPU检测
ipcMain.handle('detect-gpu', async () => {
    if (!gpuCapabilities) {
        try {
            gpuCapabilities = await detectGPUCapabilities();
        } catch (e) {
            return 'CPU 模式';
        }
    }
    return getGPUDisplayName(gpuCapabilities);
});

// 获取视频信息
ipcMain.handle('get-video-info', async (event, filePath) => {
    try {
        const info = await getVideoInfo(filePath);
        return info;
    } catch (error) {
        console.error('读取视频信息失败:', error);
        // 返回基础信息，不抛出错误
        return {
            duration: 0,
            width: 0,
            height: 0,
            codec: 'unknown',
            bitrate: 0,
            size: 0,
            hasAudio: true,
            hasSubtitles: false,
            subtitleCount: 0,
            subtitles: []
        };
    }
});

// 开始压缩
ipcMain.handle('start-compression', async (event, task) => {
    const {
        id,
        inputPath,
        outputDir,
        volume = 100,
        crf = 26,
        width = -1,
        skipStart = 0,
        skipEnd = 0,
        selectedSubtitleIndex = -1,
        subtitlePath = null,
        externalSubtitleStreamIndex = 0,
        selectedAudioStreamIndex = 0,
        encoder = 'libx264'
    } = task;

    try {
        const outputPath = generateOutputPath(inputPath, outputDir);

        const options = {
            width: (width && width > 0) ? width : -1,
            height: -2,
            crf: crf,
            preset: 'veryfast',
            volume: volume / 100,
            skipStart: skipStart || 0,
            skipEnd: skipEnd || 0,
            // 内置字幕流索引（-1 表示不烧录）
            subtitleStreamIndex: selectedSubtitleIndex >= 0 ? selectedSubtitleIndex : -1,
            subtitlePath: subtitlePath,
            externalSubtitleStreamIndex: externalSubtitleStreamIndex,
            selectedAudioStreamIndex: selectedAudioStreamIndex,
            encoder: encoder
        };

        // 发送开始事件
        mainWindow.webContents.send('compression-start', { id });

        // 执行压缩，保存命令引用以支持停止
        const command = await compressVideo(inputPath, outputPath, options, (progress) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('compression-progress', {
                    id,
                    progress: progress.percent || 0,
                    speed: progress.currentFps || 0
                });
            }
        }, (cmd) => {
            // 保存命令引用
            activeTasks.set(id, cmd);
        });

        activeTasks.delete(id);

        // 如果是被手动停止的，发送 stopped 事件，不发送 complete
        if (command && command.stopped) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('compression-stopped', { id });
            }
            return { success: false, stopped: true };
        }

        // 获取输出文件大小
        let outputSize = 0;
        try {
            const stat = fs.statSync(outputPath);
            outputSize = stat.size;
        } catch (e) {}

        // 发送完成事件
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('compression-complete', {
                id,
                outputPath,
                outputSize
            });
        }

        return { success: true, outputPath };
    } catch (error) {
        activeTasks.delete(id);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('compression-error', {
                id,
                error: error.message || '未知错误'
            });
        }
        throw error;
    }
});

// 停止所有压缩
ipcMain.handle('stop-compression', async (event) => {
    for (const [id, cmd] of activeTasks.entries()) {
        try {
            killTask(cmd);
        } catch (e) {
            console.error('停止任务失败:', e);
        }
    }
    activeTasks.clear();
    return { success: true };
});
