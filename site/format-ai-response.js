(() => {
  function appendInline(target, text) {
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((part) => {
      const match = part.match(/^\*\*([^*]+)\*\*$/);
      if (match) {
        const strong = document.createElement('strong');
        strong.textContent = match[1];
        target.append(strong);
      } else if (part) {
        target.append(document.createTextNode(part));
      }
    });
  }

  function createTextBlock(tagName, text) {
    const block = document.createElement(tagName);
    appendInline(block, text.replace(/\s{2,}$/g, '').trim());
    return block;
  }

  window.renderInterpretation = (container, markdown) => {
    container.replaceChildren();
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    let list;
    let paragraph = [];
    const flushParagraph = () => {
      if (!paragraph.length) return;
      container.append(createTextBlock('p', paragraph.join(' ')));
      paragraph = [];
    };
    const closeList = () => { list = undefined; };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      const heading = line.match(/^\*\*(.+?)\*\*$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+[.、]\s+(.+)$/);
      if (!line) { flushParagraph(); closeList(); return; }
      if (heading) {
        flushParagraph(); closeList();
        container.append(createTextBlock('h4', heading[1]));
        return;
      }
      if (bullet || ordered) {
        flushParagraph();
        const type = ordered ? 'ol' : 'ul';
        if (!list || list.tagName.toLowerCase() !== type) {
          list = document.createElement(type);
          container.append(list);
        }
        list.append(createTextBlock('li', (bullet || ordered)[1]));
        return;
      }
      closeList();
      paragraph.push(line);
    });
    flushParagraph();
  };
})();
