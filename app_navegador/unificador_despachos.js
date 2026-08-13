(function () {
  "use strict";

  const PARAGRAPH_CLASS = "Texto_Justificado_Recuo_Primeira_Linha";
  const MAIN_ITEM_PATTERN = /^1\.(\d+)\.?\s+CAD PM\b/i;
  const PLATOON_PATTERN = /([1-9]\d*)\s*(?:º|°|o)?\s*CFO\s*["“”']?\s*([A-Z])\s*["“”']?/i;
  const RESPONSIBLE_ROLE_PATTERN = /Cad PM\s*-\s*Resp\.\s*Restr\.\/Conval\.\/LTS(?:\s+do\s+\d+\s*(?:º|°|o)?\s*CFO\s*["“”']?\s*[A-Z]\s*["“”']?)?/i;

  function unify(sources) {
    validateSources(sources);

    const parsedSources = sources.map((source) => {
      const doc = parseHtml(source.html, source.name);
      return {
        name: source.name,
        doc,
        responsible: extractResponsible(doc, source.name),
      };
    });
    const selectedResponsible = selectOldestResponsible(parsedSources);
    const filledGroups = [];
    let placeholderGroup = null;

    parsedSources.forEach((source) => {
      const groups = extractGroups(source.doc, source.name);
      groups.forEach((group) => {
        if (group.isPlaceholder) {
          placeholderGroup ||= group;
        } else {
          filledGroups.push(group);
        }
      });
    });

    const finalGroups = [...filledGroups];
    if (placeholderGroup) finalGroups.push(placeholderGroup);
    if (!finalGroups.length) {
      throw new Error("Nenhum afastamento foi encontrado nos despachos selecionados.");
    }

    const model = parsedSources[0].doc;
    const modelName = parsedSources[0].name;
    const paragraphs = getDispatchParagraphs(model);
    const introduction = findParagraph(paragraphs, "1. Encaminho", modelName);
    const closing = findParagraph(paragraphs, "2. Nada mais a informar", modelName);

    if (introduction.parentElement !== closing.parentElement) {
      throw new Error(`A introducao e o encerramento de ${modelName} nao estao no mesmo bloco.`);
    }
    if (!(introduction.compareDocumentPosition(closing) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      throw new Error(`A ordem da introducao e do encerramento de ${modelName} e invalida.`);
    }

    removeNodesBetween(introduction, closing);
    finalGroups.forEach((group, index) => {
      group.paragraphs.forEach((paragraph) => {
        const clone = model.importNode(paragraph, true);
        renumberParagraph(clone, index + 1);
        closing.parentElement.insertBefore(clone, closing);
      });
    });

    applyUnifiedIdentification(model, parsedSources[0].responsible, selectedResponsible);
    if (model.title) model.title = "Despacho por pelotoes unificado";
    validateResult(model, finalGroups.length, selectedResponsible);

    return {
      html: `<!doctype html>\n${model.documentElement.outerHTML}`,
      filledCount: filledGroups.length,
      totalCount: finalGroups.length,
      placeholderKept: Boolean(placeholderGroup),
      responsibleCadet: selectedResponsible.cadetName,
      responsiblePlatoon: selectedResponsible.platoon.label,
    };
  }

  function validateSources(sources) {
    if (!Array.isArray(sources) || sources.length < 2) {
      throw new Error("Selecione pelo menos dois despachos HTML.");
    }

    sources.forEach((source, index) => {
      const name = String(source?.name || `arquivo ${index + 1}`);
      if (!/\.html?$/i.test(name)) {
        throw new Error(`${name} nao e um arquivo HTML valido.`);
      }
      if (typeof source?.html !== "string" || !source.html.trim()) {
        throw new Error(`${name} esta vazio ou nao pode ser lido.`);
      }
    });
  }

  function parseHtml(html, name) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (doc.querySelector("parsererror") || !doc.documentElement || !doc.body) {
      throw new Error(`Nao foi possivel interpretar ${name} como HTML.`);
    }
    return doc;
  }

  function getDispatchParagraphs(doc) {
    return Array.from(doc.querySelectorAll(`p.${PARAGRAPH_CLASS}`));
  }

  function extractGroups(doc, name) {
    const paragraphs = getDispatchParagraphs(doc);
    const groups = [];

    for (let index = 0; index < paragraphs.length; index += 1) {
      const mainMatch = normalizedText(paragraphs[index]).match(MAIN_ITEM_PATTERN);
      if (!mainMatch) continue;

      const oldNumber = mainMatch[1];
      const subitemPattern = new RegExp(`^1\\.${escapeRegExp(oldNumber)}\\.\\d+\\.\\s`, "i");
      const groupParagraphs = [paragraphs[index]];
      let nextIndex = index + 1;

      while (nextIndex < paragraphs.length && subitemPattern.test(normalizedText(paragraphs[nextIndex]))) {
        groupParagraphs.push(paragraphs[nextIndex]);
        nextIndex += 1;
      }

      if (groupParagraphs.length === 1) {
        throw new Error(`O item 1.${oldNumber} de ${name} nao possui subitens.`);
      }

      groups.push({
        paragraphs: groupParagraphs,
        isPlaceholder: normalizeForSearch(groupParagraphs.map(normalizedText).join(" ")).includes("CAMPO AUTOMATICO"),
      });
      index = nextIndex - 1;
    }

    if (!groups.length) {
      throw new Error(`Nenhum afastamento numerado foi encontrado em ${name}.`);
    }
    return groups;
  }

  function extractResponsible(doc, name) {
    const paragraphs = Array.from(doc.querySelectorAll("p"));
    let roleIndex = -1;

    for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
      if (/^Cad PM\s*-\s*Resp\.\s*Restr\.\/Conval\.\/LTS\s+do\s+/i.test(normalizedText(paragraphs[index]))) {
        roleIndex = index;
        break;
      }
    }

    if (roleIndex === -1) {
      throw new Error(`Nao foi localizada a assinatura do cadete responsavel em ${name}.`);
    }

    const roleParagraph = paragraphs[roleIndex];
    const platoonMatch = normalizedText(roleParagraph).match(PLATOON_PATTERN);
    if (!platoonMatch) {
      throw new Error(`Nao foi possivel identificar o pelotao do responsavel em ${name}.`);
    }

    let nameParagraph = null;
    for (let index = roleIndex - 1; index >= 0; index -= 1) {
      if (normalizedText(paragraphs[index])) {
        nameParagraph = paragraphs[index];
        break;
      }
    }

    if (!nameParagraph) {
      throw new Error(`Nao foi localizado o nome do cadete responsavel em ${name}.`);
    }

    return {
      cadetName: normalizedText(nameParagraph),
      nameParagraph,
      roleParagraph,
      platoon: {
        number: Number(platoonMatch[1]),
        letter: platoonMatch[2].toUpperCase(),
        label: `${platoonMatch[1]}${platoonMatch[2].toUpperCase()}`,
      },
    };
  }

  function selectOldestResponsible(parsedSources) {
    return parsedSources
      .map((source, sourceIndex) => ({ ...source.responsible, sourceIndex }))
      .sort((first, second) => {
        const numberDifference = second.platoon.number - first.platoon.number;
        if (numberDifference) return numberDifference;
        const letterDifference = first.platoon.letter.localeCompare(second.platoon.letter, "pt-BR");
        return letterDifference || first.sourceIndex - second.sourceIndex;
      })[0];
  }

  function applyUnifiedIdentification(model, modelResponsible, selectedResponsible) {
    const paragraphs = Array.from(model.querySelectorAll("p"));

    paragraphs.forEach((paragraph) => {
      const text = normalizedText(paragraph);
      if (/^(?:Do\s+)?Cad PM\s*-\s*Resp\.\s*Restr\.\/Conval\.\/LTS(?:\s+do\s+|$)/i.test(text)) {
        replaceTextNodes(paragraph, RESPONSIBLE_ROLE_PATTERN, "Cad PM - Resp. Restr./Conval./LTS");
      }
      if (/^Assunto:\s*Afastamentos\s+do\s+/i.test(text)) {
        replaceTextNodes(
          paragraph,
          /Afastamentos\s+do\s+\d+\s*(?:º|°|o)?\s*CFO\s*["“”']?\s*[A-Z]\s*["“”']?/i,
          "Afastamentos dos pelotões da 1ª Cia",
        );
      }
    });

    replaceParagraphText(modelResponsible.nameParagraph, selectedResponsible.cadetName);
  }

  function replaceTextNodes(element, pattern, replacement) {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let replaced = false;
    let textNode = walker.nextNode();

    while (textNode) {
      if (pattern.test(textNode.nodeValue)) {
        textNode.nodeValue = textNode.nodeValue.replace(pattern, replacement);
        replaced = true;
      }
      textNode = walker.nextNode();
    }
    return replaced;
  }

  function replaceParagraphText(paragraph, replacement) {
    const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let textNode = walker.nextNode();

    while (textNode) {
      if (textNode.nodeValue.trim()) textNodes.push(textNode);
      textNode = walker.nextNode();
    }
    if (!textNodes.length) throw new Error("Nao foi possivel atualizar o nome do cadete responsavel.");

    const leadingSpace = textNodes[0].nodeValue.match(/^\s*/)?.[0] || "";
    const trailingSpace = textNodes.at(-1).nodeValue.match(/\s*$/)?.[0] || "";
    textNodes[0].nodeValue = `${leadingSpace}${replacement}${trailingSpace}`;
    textNodes.slice(1).forEach((node) => {
      node.nodeValue = "";
    });
  }

  function findParagraph(paragraphs, prefix, name) {
    const paragraph = paragraphs.find((item) => normalizedText(item).startsWith(prefix));
    if (!paragraph) {
      throw new Error(`Nao foi localizado o paragrafo "${prefix}" em ${name}.`);
    }
    return paragraph;
  }

  function removeNodesBetween(start, end) {
    let node = start.nextSibling;
    while (node && node !== end) {
      const next = node.nextSibling;
      node.remove();
      node = next;
    }
  }

  function renumberParagraph(paragraph, number) {
    const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const numberPattern = /1\.\d+((?:\.\d+)?)(\.)?(?=\s)/;
    let changed = false;
    let textNode = walker.nextNode();

    while (textNode) {
      if (numberPattern.test(textNode.nodeValue)) {
        textNode.nodeValue = textNode.nodeValue.replace(
          numberPattern,
          (_match, subitem) => `1.${number}${subitem || ""}.`,
        );
        changed = true;
        break;
      }
      textNode = walker.nextNode();
    }

    if (!changed) throw new Error(`Nao foi possivel renumerar o item ${number}.`);
  }

  function validateResult(doc, expectedGroups, selectedResponsible) {
    if (doc.querySelectorAll("html").length !== 1) {
      throw new Error("O despacho final possui uma estrutura HTML invalida.");
    }
    if (!doc.documentElement || !doc.body) {
      throw new Error("O despacho final nao possui uma estrutura HTML completa.");
    }

    const paragraphs = getDispatchParagraphs(doc);
    const mainItems = paragraphs.filter((paragraph) => MAIN_ITEM_PATTERN.test(normalizedText(paragraph)));
    const introductions = paragraphs.filter((paragraph) => normalizedText(paragraph).startsWith("1. Encaminho"));
    const closings = paragraphs.filter((paragraph) => normalizedText(paragraph).startsWith("2. Nada mais a informar"));
    const allParagraphs = Array.from(doc.querySelectorAll("p"));
    const sender = allParagraphs.find((paragraph) => normalizedText(paragraph).startsWith("Do Cad PM - Resp."));
    const subject = allParagraphs.find((paragraph) => normalizedText(paragraph).startsWith("Assunto:"));
    const signatureRole = allParagraphs.find((paragraph) => normalizedText(paragraph) === "Cad PM - Resp. Restr./Conval./LTS");

    if (mainItems.length !== expectedGroups) {
      throw new Error(`A validacao encontrou ${mainItems.length} itens, mas eram esperados ${expectedGroups}.`);
    }
    if (introductions.length !== 1 || closings.length !== 1) {
      throw new Error("O despacho final precisa ter uma unica introducao e um unico encerramento.");
    }
    if (normalizedText(sender) !== "Do Cad PM - Resp. Restr./Conval./LTS") {
      throw new Error("A identificacao do remetente nao foi atualizada corretamente.");
    }
    if (normalizedText(subject) !== "Assunto: Afastamentos dos pelotões da 1ª Cia") {
      throw new Error("O assunto do despacho unificado nao foi atualizado corretamente.");
    }
    if (!signatureRole) {
      throw new Error("A funcao do cadete responsavel nao foi atualizada na assinatura.");
    }

    const signatureParagraphs = allParagraphs;
    const roleIndex = signatureParagraphs.indexOf(signatureRole);
    let signerName = "";
    for (let index = roleIndex - 1; index >= 0; index -= 1) {
      signerName = normalizedText(signatureParagraphs[index]);
      if (signerName) break;
    }
    if (signerName !== selectedResponsible.cadetName) {
      throw new Error("O nome do cadete mais antigo nao foi aplicado na assinatura.");
    }
  }

  function normalizedText(element) {
    return String(element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function normalizeForSearch(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  window.despachoHtmlUnifier = Object.freeze({ unify });
})();
