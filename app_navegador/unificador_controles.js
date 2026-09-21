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

  function splitSignatureColumns(element) {
    return String(element?.textContent || "")
      .split(/(?:\u00a0[ \t]*){2,}/)
      .map((value) => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function signatureCategory(role) {
    const value = normalize(role);
    if (value.includes("CAD PM") && value.includes("CFO")) return "cadet";
    if (/\bCAP(?:ITAO)? PM\b/.test(value)) return "captain";
    if (/\bTEN(?:ENTE)? PM\b/.test(value)) return "lieutenant";
    return "";
  }

  function findSignatureDate(doc) {
    return Array.from(doc.querySelectorAll("p")).find((paragraph) => {
      const value = normalize(paragraph.textContent);
      return value.includes("SAO PAULO") && value.includes("DATA DA ASSINATURA DIGITAL");
    });
  }

  function findLastTableBefore(element) {
    if (!element) return null;
    return Array.from(element.ownerDocument.querySelectorAll("table"))
      .filter((table) => table.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
      .at(-1) || null;
  }

  function extractSignatures(doc, sourceName, sourceLabel) {
    const dateParagraph = findSignatureDate(doc);
    const lastTable = findLastTableBefore(dateParagraph);
    if (!dateParagraph || !lastTable) {
      throw new Error(`${sourceName}: nao encontrei a area de assinaturas do controle.`);
    }

    const region = [];
    let element = lastTable.nextElementSibling;
    while (element && element !== dateParagraph) {
      region.push(element);
      element = element.nextElementSibling;
    }

    const signatures = [];
    for (let index = 0; index < region.length; index += 1) {
      const roles = splitSignatureColumns(region[index]).filter((value) => signatureCategory(value));
      if (!roles.length) continue;

      let nameColumns = [];
      for (let previous = index - 1; previous >= 0; previous -= 1) {
        const candidate = splitSignatureColumns(region[previous]);
        if (!candidate.length || candidate.some((value) => signatureCategory(value))) continue;
        nameColumns = candidate;
        break;
      }

      roles.forEach((role, roleIndex) => {
        const name = nameColumns[roleIndex] || (roles.length === 1 ? nameColumns.at(-1) : "");
        if (name) {
          signatures.push({
            name,
            role,
            category: signatureCategory(role),
            sourceLabel,
          });
        }
      });
    }

    if (!signatures.some((signature) => signature.category === "cadet")) {
      throw new Error(`${sourceName}: nao encontrei a assinatura do cadete responsavel.`);
    }
    return signatures;
  }

  function cadetCourseNumber(signature) {
    const value = `${signature.role} ${signature.sourceLabel}`;
    const match = value.match(/([123])\s*(?:º|°|o)?\s*CFO\b/i);
    return match ? Number(match[1]) : 99;
  }

  function signaturePriority(signature) {
    if (signature.category === "cadet") return cadetCourseNumber(signature) * 100;
    if (signature.category === "lieutenant") return 400;
    if (signature.category === "captain") return 500;
    return 900;
  }

  function consolidateSignatures(sources) {
    const unique = new Map();
    for (const source of sources) {
      for (const signature of source.signatures) {
        const key = `${normalize(signature.name)}|${normalize(signature.role)}`;
        if (!unique.has(key)) unique.set(key, signature);
      }
    }

    return Array.from(unique.values()).sort((left, right) =>
      signaturePriority(left) - signaturePriority(right)
      || normalize(left.sourceLabel).localeCompare(normalize(right.sourceLabel), "pt-BR")
      || normalize(left.name).localeCompare(normalize(right.name), "pt-BR"),
    );
  }

  function rebuildSignatureBlock(doc, signatures) {
    const dateParagraph = findSignatureDate(doc);
    const lastTable = findLastTableBefore(dateParagraph);
    if (!dateParagraph || !lastTable) {
      throw new Error("Nao foi possivel reconstruir a area de assinaturas.");
    }

    let element = lastTable.nextElementSibling;
    while (element && element !== dateParagraph) {
      const current = element;
      element = element.nextElementSibling;
      current.remove();
    }

    const container = doc.createElement("div");
    container.id = "assinaturas-controle-unificado";
    for (const signature of signatures) {
      const item = doc.createElement("div");
      item.className = "assinatura-controle-unificado";

      const name = doc.createElement("p");
      name.className = "assinatura-controle-nome";
      name.textContent = signature.name;

      const role = doc.createElement("p");
      role.className = "assinatura-controle-funcao";
      role.textContent = signature.role;

      item.append(name, role);
      container.append(item);
    }
    dateParagraph.before(container);
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

      const label = extractSourceLabel(doc, source.name);
      return {
        ...source,
        doc,
        mainTable,
        rows,
        label,
        signatures: extractSignatures(doc, source.name, label),
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
    const signatures = consolidateSignatures(parsed);

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
    rebuildSignatureBlock(model.doc, signatures);
    model.doc.title = "Controle unificado";

    model.doc.querySelector("#unified-table-style")?.remove();
    const style = model.doc.createElement("style");
    style.id = "unified-table-style";
    style.textContent = `
      #tabela-controle-unificada { break-inside: auto; }
      #tabela-controle-unificada tr { break-inside: avoid; page-break-inside: avoid; }
      #tabela-controle-unificada .pelotao-separador { break-after: avoid; page-break-after: avoid; }
      #assinaturas-controle-unificado {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 28px;
        row-gap: 28px;
        width: 765px;
        max-width: calc(100% - 1px);
        margin: 36px 0 24px 1px;
      }
      #assinaturas-controle-unificado .assinatura-controle-unificado {
        min-height: 58px;
        text-align: left;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      #assinaturas-controle-unificado p {
        font-family: "Times New Roman", serif;
        font-size: 12pt;
        line-height: 1.2;
        margin: 0;
        text-align: left;
      }
      #assinaturas-controle-unificado .assinatura-controle-nome { font-weight: normal; }
      #assinaturas-controle-unificado .assinatura-controle-funcao { margin-top: 2px; }
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
      signatureCount: signatures.length,
      responsibleCadet: signatures.find((signature) => signature.category === "cadet")?.name || "",
      responsiblePlatoon: signatures.find((signature) => signature.category === "cadet")?.sourceLabel || "",
    };
  }

  window.controleHtmlUnifier = Object.freeze({ unify });
})();
