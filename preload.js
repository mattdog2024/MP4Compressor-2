const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 文件选择
    selectFiles: () => ipcRenderer.invoke('select-files'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
    selectExternalSubtitle: () => ipcRenderer.invoke('select-external-subtitle'),

    // 获取文件夹中的视频文件
    getFilesInFolder: (folderPath) => ipcRenderer.invoke('get-files-in-folder', folderPath),

    // 视频处理
    getVideoInfo: (filePath) => ipcRenderer.invoke('get-video-info', filePath),
    startCompression: (task) => ipcRenderer.invoke('start-compression', task),
    stopCompression: () => ipcRenderer.invoke('stop-compression'),

    // GPU 检测
    detectGPU: () => ipcRenderer.invoke('detect-gpu'),

    // 事件监听（支持移除）
    onProgress: (callback) => ipcRenderer.on('compression-progress', callback),
    onComplete: (callback) => ipcRenderer.on('compression-complete', callback),
    onError: (callback) => ipcRenderer.on('compression-error', callback),
    onStart: (callback) => ipcRenderer.on('compression-start', callback),
    onStopped: (callback) => ipcRenderer.on('compression-stopped', callback),

    // 移除监听
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
