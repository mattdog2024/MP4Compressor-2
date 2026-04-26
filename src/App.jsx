const { useState, useEffect } = React;

function App() {
    const [videos, setVideos] = useState([]);
    const [volume, setVolume] = useState(100);
    const [concurrency, setConcurrency] = useState(2);
    const [outputDir, setOutputDir] = useState('');
    const [gpuMode, setGpuMode] = useState('检测中...');
    const [isCompressing, setIsCompressing] = useState(false);
    const [subtitleDialog, setSubtitleDialog] = useState({
        show: false,
        videoId: null,
        subtitles: []
    });

    // 检测GPU
    useEffect(() => {
        window.electronAPI.detectGPU().then(mode => {
            setGpuMode(mode);
        });
    }, []);

    // 压缩进度处理
    useEffect(() => {
        const handleProgress = (event, data) => {
            setVideos(prev => prev.map(v =>
                v.id === data.id
                    ? { ...v, status: `压缩中 ${data.progress.toFixed(0)}%`, progress: data.progress }
                    : v
            ));
        };

        const handleComplete = (event, data) => {
            setVideos(prev => prev.map(v =>
                v.id === data.id
                    ? { ...v, status: '✓ 完成', progress: 100 }
                    : v
            ));
        };

        const handleError = (event, data) => {
            setVideos(prev => prev.map(v =>
                v.id === data.id
                    ? { ...v, status: `✗ 失败: ${data.error}`, progress: 0 }
                    : v
            ));
        };

        window.electronAPI.onProgress(handleProgress);
        window.electronAPI.onComplete(handleComplete);
        window.electronAPI.onError(handleError);

        return () => {
            // 清理事件监听（需要在preload.js中实现removeListener）
        };
    }, []);

    // 当检测到字幕时显示对话框
    useEffect(() => {
        videos.forEach(video => {
            if (video.hasSubtitles && !video.selectedSubtitle && !video.subtitleSkipped) {
                setSubtitleDialog({
                    show: true,
                    videoId: video.id,
                    subtitles: video.subtitles
                });
            }
        });
    }, [videos]);

    // 添加视频文件
    const handleAddFiles = async () => {
        const files = await window.electronAPI.selectFiles();
        if (files && files.length > 0) {
            const newVideos = await Promise.all(files.map(async (file) => {
                const info = await window.electronAPI.getVideoInfo(file);
                return {
                    id: Date.now() + Math.random(),
                    path: file,
                    name: file.split('\\').pop(),
                    ...info,
                    status: '等待中',
                    progress: 0,
                    selectedSubtitle: null
                };
            }));
            setVideos(prev => [...prev, ...newVideos]);
        }
    };

    // 添加文件夹
    const handleAddFolder = async () => {
        const folder = await window.electronAPI.selectFolder();
        if (folder) {
            // 处理文件夹中的视频文件
            // 实现在后续任务中
        }
    };

    // 清空队列
    const handleClearQueue = () => {
        setVideos([]);
    };

    // 开始压缩处理
    const handleStartCompression = async () => {
        if (videos.length === 0) {
            alert('请先添加视频文件');
            return;
        }

        setIsCompressing(true);

        try {
            for (const video of videos) {
                await window.electronAPI.startCompression({
                    id: video.id,
                    inputPath: video.path,
                    outputDir: outputDir || null,
                    volume: volume,
                    selectedSubtitle: video.selectedSubtitle,
                    encoder: gpuMode.includes('GPU') ? 'h264_nvenc' : 'libx264'
                });
            }
        } catch (error) {
            console.error('压缩失败:', error);
        } finally {
            setIsCompressing(false);
        }
    };

    // 停止压缩
    const handleStopCompression = async () => {
        // 实现停止逻辑
        setIsCompressing(false);
    };

    // 处理字幕选择
    const handleSubtitleSelect = (subtitleIndex) => {
        setVideos(prev => prev.map(v =>
            v.id === subtitleDialog.videoId
                ? {
                    ...v,
                    selectedSubtitle: subtitleIndex,
                    subtitleSkipped: true
                }
                : v
        ));
        setSubtitleDialog({ show: false, videoId: null, subtitles: [] });
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>🎬 视频压缩器</h1>
                <p style={styles.gpuStatus}>加速模式：{gpuMode}</p>
            </header>

            <div style={styles.buttonGroup}>
                <button style={styles.primaryButton} onClick={handleAddFiles}>
                    添加视频
                </button>
                <button style={styles.primaryButton} onClick={handleAddFolder}>
                    添加文件夹
                </button>
                <button style={styles.secondaryButton} onClick={handleClearQueue}>
                    清空列表
                </button>
            </div>

            <div style={styles.queueContainer}>
                <h3 style={styles.queueTitle}>压缩队列 ({videos.length})</h3>
                {videos.length === 0 ? (
                    <p style={styles.emptyMessage}>暂无视频文件</p>
                ) : (
                    videos.map(video => (
                        <div key={video.id} style={styles.videoItem}>
                            <div style={styles.videoHeader}>
                                <span>📹 {video.name}</span>
                                <span style={styles.videoInfo}>
                                    {video.width}×{video.height} {volume}%
                                </span>
                            </div>
                            <div style={styles.videoStatus}>
                                {video.selectedSubtitle ? `✓ 已选：${video.selectedSubtitle}` : '字幕：无'}
                                <br />
                                状态：{video.status}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div style={styles.controlsContainer}>
                <div style={styles.controlItem}>
                    <label>音量调整：{volume}%</label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(parseInt(e.target.value))}
                        style={styles.slider}
                    />
                </div>

                <div style={styles.controlItem}>
                    <label>同时压缩：{concurrency} 个文件</label>
                    <input
                        type="number"
                        min="1"
                        max="2"
                        value={concurrency}
                        onChange={(e) => setConcurrency(parseInt(e.target.value))}
                        style={styles.numberInput}
                    />
                </div>

                <div style={styles.controlItem}>
                    <label>输出目录：</label>
                    <input
                        type="text"
                        value={outputDir || '默认目录'}
                        readOnly
                        style={styles.textInput}
                    />
                </div>

                <div style={styles.buttonGroup}>
                    <button
                        style={styles.startButton}
                        onClick={handleStartCompression}
                        disabled={isCompressing || videos.length === 0}
                    >
                        {isCompressing ? '压缩中...' : '开始压缩'}
                    </button>
                    <button style={styles.stopButton}>停止</button>
                </div>
            </div>

            {subtitleDialog.show && (
                <SubtitleDialog
                    subtitles={subtitleDialog.subtitles}
                    onSelect={handleSubtitleSelect}
                    onClose={() => setSubtitleDialog({ show: false, videoId: null, subtitles: [] })}
                />
            )}
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: '"Microsoft YaHei", sans-serif'
    },
    header: {
        backgroundColor: '#2196F3',
        color: 'white',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    title: {
        margin: '0 0 10px 0',
        fontSize: '24px'
    },
    gpuStatus: {
        margin: 0,
        fontSize: '14px',
        opacity: 0.9
    },
    buttonGroup: {
        display: 'flex',
        gap: '10px',
        padding: '20px',
        justifyContent: 'center'
    },
    primaryButton: {
        padding: '10px 20px',
        backgroundColor: '#2196F3',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold'
    },
    secondaryButton: {
        padding: '10px 20px',
        backgroundColor: '#757575',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '14px'
    },
    queueContainer: {
        flex: 1,
        padding: '20px',
        overflowY: 'auto'
    },
    queueTitle: {
        color: '#333',
        marginBottom: '15px'
    },
    emptyMessage: {
        color: '#999',
        textAlign: 'center',
        marginTop: '50px'
    },
    videoItem: {
        backgroundColor: 'white',
        padding: '15px',
        marginBottom: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    videoHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        fontWeight: 'bold'
    },
    videoInfo: {
        color: '#666',
        fontSize: '12px'
    },
    videoStatus: {
        color: '#666',
        fontSize: '13px',
        lineHeight: '1.6'
    },
    controlsContainer: {
        padding: '20px',
        backgroundColor: 'white',
        borderTop: '1px solid #e0e0e0'
    },
    controlItem: {
        marginBottom: '15px'
    },
    slider: {
        width: '100%',
        marginTop: '5px'
    },
    numberInput: {
        width: '60px',
        padding: '5px',
        border: '1px solid #ddd',
        borderRadius: '4px'
    },
    textInput: {
        flex: 1,
        padding: '8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: '#f9f9f9'
    },
    startButton: {
        padding: '12px 40px',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold'
    },
    stopButton: {
        padding: '12px 40px',
        backgroundColor: '#f44336',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '16px'
    }
};

// 渲染应用
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
