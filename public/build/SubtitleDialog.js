function SubtitleDialog({
  subtitles,
  onSelect,
  onClose
}) {
  const [selected, setSelected] = React.useState(null);
  const handleSelect = () => {
    onSelect(selected);
    onClose();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: styles.overlay
  }, /*#__PURE__*/React.createElement("div", {
    style: styles.dialog
  }, /*#__PURE__*/React.createElement("h3", {
    style: styles.title
  }, "\u9009\u62E9\u5B57\u5E55\u8F68\u9053"), /*#__PURE__*/React.createElement("div", {
    style: styles.options
  }, /*#__PURE__*/React.createElement("label", {
    style: styles.option
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "subtitle",
    checked: selected === null,
    onChange: () => setSelected(null)
  }), "\u4E0D\u5D4C\u5165\u5B57\u5E55"), subtitles.map((sub, index) => /*#__PURE__*/React.createElement("label", {
    key: index,
    style: styles.option
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "subtitle",
    checked: selected === index,
    onChange: () => setSelected(index)
  }), sub.title, " (", sub.language, ")"))), /*#__PURE__*/React.createElement("div", {
    style: styles.buttons
  }, /*#__PURE__*/React.createElement("button", {
    style: styles.confirmButton,
    onClick: handleSelect
  }, "\u786E\u5B9A"), /*#__PURE__*/React.createElement("button", {
    style: styles.cancelButton,
    onClick: onClose
  }, "\u53D6\u6D88"))));
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
