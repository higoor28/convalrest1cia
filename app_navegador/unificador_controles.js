(() => {
  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function findMainTable(doc) {
    return Array.from(doc.querySelectorAll("table")).find((table) =>
      normalize(table.textContent).includes("AL OF PM"),
    );
  }

  function extractSourceLabel(doc, fileName) {
    for (const paragraph of doc.querySelectorAll("p")) {
      const match = paragraph.textContent.match(/Pelot[aã]o\s*:\s*(.+)/i);
      if (match?.[1]?.trim()) return match[1].trim();
    }
    return String(fileName || "Arquivo HTML").replace(/\.html?$/i, "").replaceAll("_", " ").trim();
  }

  function createSourceSeparator(doc, label, columnCount) {
    const row = doc.createElement("tr");
    row.className = "pelotao-separador";

    const cell = doc.createElement("td");
    cell.colSpan = Math.max(1, columnCount);
    cell.style.cssText = "border:1px solid black;padding:5px 7px;background-color:#d9e2f3;text-align:center;font-weight:bold";
    cell.textContent = `Pelotão: ${label}`;
    row.append(cell);
    return row;
  }

  function updateHeading(doc, labels) {
    const joined = labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;

    for (const paragraph of doc.querySelectorAll("p")) {
      if (!/Pelot[aã]o\s*:/i.test(paragraph.textContent)) continue;
      const walker = doc.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        if (/Pelot[aã]o\s*:/i.test(textNode.nodeValue || "")) {
          textNode.nodeValue = textNode.nodeValue.replace(
            /Pelot[aã]o\s*:\s*.*/i,
            `Pelotões: ${joined} `,
          );
          return;
        }
        textNode = walker.nextNode();
      }
    }
  }

  function extractResponsibleCadet(doc) {
    const roleParagraph = Array.from(doc.querySelectorAll("p")).find((paragraph) =>
      normalize(paragraph.textContent).includes("CAD PM - RESP. RESTR./CONVAL./LTS DO"),
    );
    if (!roleParagraph) return { name: "", heading: null, roleParagraph: null };

    let heading = roleParagraph.previousElementSibling;
    while (heading && heading.tagName !== "H1") heading = heading.previousElementSibling;
    if (!heading) return { name: "", heading: null, roleParagraph };

    const names = heading.textContent
      .split(/(?:\u00a0[ \t]*){2,}/)
      .map((value) => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    return { name: names[0] || "", heading, roleParagraph };
  }

  function platoonPriority(label) {
    const match = String(label || "").match(
      /(\d+)\s*(?:º|°|o)?\s*(?:CFO)?\s*["“”']?\s*([A-Z])\b/i,
    );
    if (!match) return Number.NEGATIVE_INFINITY;
    const number = Number(match[1]);
    const letter = match[2].toUpperCase().charCodeAt(0) - 65;
    return number * 100 - letter;
  }

  function selectMostSeniorPlatoon(sources) {
    return sources.reduce((selected, current) =>
      platoonPriority(current.label) > platoonPriority(selected.label) ? current : selected,
    );
  }

  function replaceTextInElement(element, search, replacement) {
    if (!element || !search || search === replacement) return false;
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      if ((textNode.nodeValue || "").includes(search)) {
        textNode.nodeValue = textNode.nodeValue.replace(search, replacement);
        return true;
      }
      textNode = walker.nextNode();
    }
    return false;
  }

  function applyResponsibleCadet(model, selected) {
    if (!selected.responsible.name) {
      throw new Error(`Nao encontrei o nome do cadete responsavel no arquivo ${selected.name}.`);
    }
    if (!model.responsible.heading || !model.responsible.roleParagraph) {
      throw new Error("Nao encontrei a assinatura do cadete responsavel no primeiro arquivo.");
    }

    replaceTextInElement(
      model.responsible.heading,
      model.responsible.name,
      selected.responsible.name,
    );
    replaceTextInElement(model.responsible.roleParagraph, model.label, selected.label);
  }

  function replaceMainHeaderLabel(headerRow) {
    const targetCell = Array.from(headerRow.cells).find((cell) =>
      normalize(cell.textContent) === "AL OF PM",
    );
    if (!targetCell) return;

    const walker = headerRow.ownerDocument.createTreeWalker(targetCell, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      if (/AL\s+OF\s+PM/i.test(textNode.nodeValue || "")) {
        textNode.nodeValue = textNode.nodeValue.replace(/AL\s+OF\s+PM/i, "CAD PM");
        return;
      }
      textNode = walker.nextNode();
    }
  }

  function unify(sources) {
    if (!Array.isArray(sources) || sources.length < 2) {
      throw new Error("Selecione pelo menos dois arquivos HTML para unificar.");
    }

    const parser = new DOMParser();
    const parsed = sources.map((source) => {
      if (!/\.html?$/i.test(source.name || "")) {
        throw new Error(`${source.name || "Arquivo"}: envie somente arquivos .html ou .htm.`);
      }
      if (!source.html || !source.html.trim()) {
        throw new Error(`${source.name}: o arquivo esta vazio.`);
      }

      const doc = parser.parseFromString(source.html, "text/html");
      const mainTable = findMainTable(doc);
      if (!mainTable) {
        throw new Error(`${source.name}: nao encontrei a tabela principal do controle.`);
      }
      if (doc.querySelectorAll("table").length < 2) {
        throw new Error(`${source.name}: nao encontrei a tabela de legenda do controle.`);
      }

      const rows = Array.from(mainTable.querySelectorAll("tr"));
      if (rows.length < 2) {
        throw new Error(`${source.name}: a tabela principal nao possui registros.`);
      }

      return {
        ...source,
        doc,
        mainTable,
        rows,
        label: extractSourceLabel(doc, source.name),
        responsible: extractResponsibleCadet(doc),
      };
    });

    const model = parsed[0];
    const modelTableCount = model.doc.querySelectorAll("table").length;
    const expectedHeader = normalize(model.rows[0].textContent);
    const columnCount = Array.from(model.rows[0].cells).reduce(
      (total, cell) => total + Math.max(1, Number(cell.colSpan) || 1),
      0,
    );
    const labels = [];
    const mergedContent = [];
    let recordCount = 0;
    const selectedResponsible = selectMostSeniorPlatoon(parsed);

    for (const source of parsed) {
      if (normalize(source.rows[0].textContent) !== expectedHeader) {
        throw new Error(`${source.name}: o cabecalho da tabela e diferente do primeiro arquivo.`);
      }

      labels.push(source.label);
      mergedContent.push(createSourceSeparator(model.doc, source.label, columnCount));
      for (const row of source.rows.slice(1)) {
        mergedContent.push(model.doc.importNode(row, true));
        recordCount += 1;
      }
    }

    const modelBody = model.mainTable.tBodies[0] || model.mainTable.createTBody();
    const header = model.doc.importNode(model.rows[0], true);
    replaceMainHeaderLabel(header);
    modelBody.replaceChildren(header, ...mergedContent);
    model.mainTable.id = "tabela-controle-unificada";
    updateHeading(model.doc, labels);
    applyResponsibleCadet(model, selectedResponsible);
    model.doc.title = "Controle unificado";

    model.doc.querySelector("#unified-table-style")?.remove();
    const style = model.doc.createElement("style");
    style.id = "unified-table-style";
    style.textContent = `
      #tabela-controle-unificada { break-inside: auto; }
      #tabela-controle-unificada tr { break-inside: avoid; page-break-inside: avoid; }
      #tabela-controle-unificada .pelotao-separador { break-after: avoid; page-break-after: avoid; }
    `;
    model.doc.head.append(style);

    const finalTables = model.doc.querySelectorAll("table");
    const finalRows = model.mainTable.querySelectorAll("tr");
    const expectedRows = 1 + parsed.length + recordCount;
    if (finalTables.length !== modelTableCount || finalRows.length !== expectedRows) {
      throw new Error("Nao foi possivel preservar todos os registros no arquivo unificado.");
    }

    return {
      html: `<!doctype html>\n${model.doc.documentElement.outerHTML}`,
      recordCount,
      responsibleCadet: selectedResponsible.responsible.name,
      responsiblePlatoon: selectedResponsible.label,
    };
  }

  window.controleHtmlUnifier = Object.freeze({ unify });
})();
