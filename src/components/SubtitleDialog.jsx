function SubtitleDialog({ subtitles, onSelect, onClose }) {
    const [selected, setSelected] = React.useState(null);

    const handleSelect = () => {
        onSelect(selected);
        onClose();
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.dialog}>
                <h3 style={styles.title}>选择字幕轨道</h3>
                <div style={styles.options}>
                    <label style={styles.option}>
                        <input
                            type="radio"
                            name="subtitle"
                            checked={selected === null}
                            onChange={() => setSelected(null)}
                        />
                        不嵌入字幕
                    </label>
                    {subtitles.map((sub, index) => (
                        <label key={index} style={styles.option}>
                            <input
                                type="radio"
                                name="subtitle"
                                checked={selected === index}
                                onChange={() => setSelected(index)}
                            />
                            {sub.title} ({sub.language})
                        </label>
                    ))}
                </div>
                <div style={styles.buttons}>
                    <button style={styles.confirmButton} onClick={handleSelect}>
                        确定
                    </button>
                    <button style={styles.cancelButton} onClick={onClose}>
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    dialog: {
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        minWidth: '300px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    },
    title: {
        margin: '0 0 20px 0',
        color: '#333'
    },
    options: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '20px'
    },
    option: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        cursor: 'pointer',
        borderRadius: '4px'
    },
    buttons: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center'
    },
    confirmButton: {
        padding: '10px 30px',
        backgroundColor: '#2196F3',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    },
    cancelButton: {
        padding: '10px 30px',
        backgroundColor: '#757575',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    }
};
