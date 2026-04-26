const { useState } = React;

function App() {
    const [count, setCount] = useState(0);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            backgroundColor: '#f5f5f5',
            fontFamily: '"Microsoft YaHei", sans-serif',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <h1 style={{ color: '#2196F3' }}>🎬 视频压缩器</h1>
            <p>测试页面</p>
            <button onClick={() => setCount(count + 1)} style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px'
            }}>
                点击次数: {count}
            </button>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
