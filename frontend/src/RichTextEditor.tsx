import React, { useRef, useCallback, useEffect } from 'react';
import { useReduxState } from './store/useReduxState';

const ToolbarIcon = ({ path, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const TOOLBAR_GROUPS = [
  [
    { command: 'bold', title: 'Bold', icon: 'M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z' },
    { command: 'italic', title: 'Italic', icon: 'M19 4h-9M14 20H5M15 4L9 20' },
    { command: 'underline', title: 'Underline', icon: 'M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3M4 21h16' },
    { command: 'strikeThrough', title: 'Strikethrough', icon: 'M16 4H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8M4 12h16' },
  ],
  [
    { command: 'insertUnorderedList', title: 'Bullet List', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
    { command: 'insertOrderedList', title: 'Numbered List', icon: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1' },
  ],
  [
    { command: 'justifyLeft', title: 'Align Left', icon: 'M3 6h18M3 12h12M3 18h18' },
    { command: 'justifyCenter', title: 'Align Center', icon: 'M6 6h12M3 12h18M6 18h12' },
    { command: 'justifyRight', title: 'Align Right', icon: 'M3 6h18M9 12h12M3 18h18' },
    { command: 'justifyFull', title: 'Justify', icon: 'M3 6h18M3 12h18M3 18h18' },
  ],
  [
    { command: 'heading', title: 'Heading', type: 'dropdown' },
    { command: 'formatBlock_blockquote', title: 'Quote', icon: 'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2sM15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4' },
  ],
  [
    { command: 'insertImage', title: 'Upload Image', type: 'image', icon: 'M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0z' },
    { command: 'removeFormat', title: 'Clear Formatting', icon: 'M17 17L7 7M17 7l-10 10' },
  ],
];

const HEADING_OPTIONS = [
  { label: 'Normal', tag: 'p' },
  { label: 'Heading 1', tag: 'h1' },
  { label: 'Heading 2', tag: 'h2' },
  { label: 'Heading 3', tag: 'h3' },
  { label: 'Heading 4', tag: 'h4' },
];

function ImageResizer({ img, onDeselect, onResize }) {
  const wrapperRef = useRef(null);
  const [dragging, setDragging] = useReduxState<boolean>('rte.imageResizer.dragging', false);
  const dragData = useRef(null);

  const handleMouseDown = (e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = img.getBoundingClientRect();
    dragData.current = {
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
      aspect: rect.width / rect.height,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e) => {
      const d = dragData.current;
      if (!d) return;

      let dx = e.clientX - d.startX;
      let dy = e.clientY - d.startY;

      // Mirror delta for left-side handles
      if (d.corner === 'nw' || d.corner === 'sw') dx = -dx;
      if (d.corner === 'nw' || d.corner === 'ne') dy = -dy;

      // Use the larger delta to maintain aspect ratio
      let newW;
      if (Math.abs(dx) > Math.abs(dy)) {
        newW = Math.max(60, d.startW + dx);
      } else {
        newW = Math.max(60, d.startW + dy * d.aspect);
      }

      img.style.width = newW + 'px';
      img.style.height = 'auto';
    };

    const handleMouseUp = () => {
      setDragging(false);
      dragData.current = null;
      onResize();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, img, onResize]);

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target) && e.target !== img) {
        onDeselect();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [img, onDeselect]);

  const rect = img.getBoundingClientRect();
  const editorRect = img.closest('.rte-content')?.getBoundingClientRect();
  if (!editorRect) return null;

  const top = rect.top - editorRect.top + img.closest('.rte-content').scrollTop;
  const left = rect.left - editorRect.left;

  return (
    <div
      ref={wrapperRef}
      className="rte-img-resizer"
      style={{
        top: top,
        left: left,
        width: rect.width,
        height: rect.height,
      }}
    >
      {['nw', 'ne', 'sw', 'se'].map((corner) => (
        <div
          key={corner}
          className={`rte-resize-handle rte-handle-${corner}`}
          onMouseDown={(e) => handleMouseDown(e, corner)}
        />
      ))}
      <div className="rte-img-size-label">
        {Math.round(rect.width)} × {Math.round(rect.height)}
      </div>
    </div>
  );
}

function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showHeadingMenu, setShowHeadingMenu] = useReduxState<boolean>('rte.showHeadingMenu', false);
  const [selectedImg, setSelectedImg] = useReduxState<HTMLImageElement | null>('rte.selectedImg', null);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const notifyChange = useCallback(() => {
    if (editorRef.current && onChange) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execCommand = useCallback((command) => {
    if (command.startsWith('formatBlock_')) {
      const tag = command.replace('formatBlock_', '');
      document.execCommand('formatBlock', false, tag);
    } else {
      document.execCommand(command, false, null);
    }
    notifyChange();
  }, [notifyChange]);

  const handleHeadingSelect = useCallback((tag) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    setShowHeadingMenu(false);
    notifyChange();
  }, [notifyChange]);

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      editorRef.current?.focus();
      const imageSource = (reader.result as string) || '';
      document.execCommand('insertImage', false, imageSource);
      // Make inserted images have a default max-width
      const imgs = editorRef.current?.querySelectorAll('img:not([style*="width"])');
      imgs?.forEach((img) => {
        img.style.width = '100%';
        img.style.height = 'auto';
      });
      notifyChange();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [notifyChange]);

  // Click on images in editor to select them for resizing
  const handleEditorClick = useCallback((e) => {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      setSelectedImg(e.target);
    } else {
      setSelectedImg(null);
    }
  }, []);

  const handleInput = useCallback(() => {
    notifyChange();
  }, [notifyChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
    }
    // Delete selected image with Backspace/Delete
    if (selectedImg && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault();
      selectedImg.remove();
      setSelectedImg(null);
      notifyChange();
    }
  }, [selectedImg, notifyChange]);

  return (
    <div className="rte-container" onClick={() => showHeadingMenu && setShowHeadingMenu(false)}>
      <div className="rte-toolbar" onMouseDown={(e) => e.preventDefault()}>
        {TOOLBAR_GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <div className="rte-separator" />}
            {group.map((btn, bi) => {
              if (btn.type === 'dropdown') {
                return (
                  <div key={bi} className="rte-dropdown-wrapper">
                    <button
                      type="button"
                      className="rte-toolbar-btn rte-dropdown-trigger"
                      title={btn.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHeadingMenu(!showHeadingMenu);
                      }}
                    >
                      <span className="rte-heading-label">H</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    {showHeadingMenu && (
                      <div className="rte-dropdown-menu">
                        {HEADING_OPTIONS.map((opt) => (
                          <button
                            key={opt.tag}
                            type="button"
                            className="rte-dropdown-item"
                            onClick={() => handleHeadingSelect(opt.tag)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              if (btn.type === 'image') {
                return (
                  <button
                    key={bi}
                    type="button"
                    className="rte-toolbar-btn"
                    title={btn.title}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ToolbarIcon path={btn.icon} />
                  </button>
                );
              }

              return (
                <button
                  key={bi}
                  type="button"
                  className="rte-toolbar-btn"
                  title={btn.title}
                  onClick={() => execCommand(btn.command)}
                >
                  <ToolbarIcon path={btn.icon} />
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      <div style={{ position: 'relative' }}>
        <div
          ref={editorRef}
          className="rte-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={handleEditorClick}
          data-placeholder="What's on your mind?"
        />

        {selectedImg && (
          <ImageResizer
            img={selectedImg}
            onDeselect={() => setSelectedImg(null)}
            onResize={notifyChange}
          />
        )}
      </div>
    </div>
  );
}

export default RichTextEditor;
