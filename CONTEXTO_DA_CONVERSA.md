# Contexto da conversa

Projeto criado em: `C:\Users\higoo\Documents\Codex\2026-05-27\crie-um-programa-que-receba-v`

## Pedido inicial

Criar um programa que receba varias fotos de documentos e una tudo em um unico PDF.

## O que foi criado

### Ajustes gerais da interface

- Tema escuro no app de navegador, com detalhes em amarelo.
- Download mais robusto: o app tenta baixar automaticamente e tambem mostra um link manual no status caso o navegador bloqueie o download automatico.
- O gerador de controle nao abre mais o seletor de salvar antes de montar o HTML, para evitar arquivo vazio caso ocorra erro durante o processamento.

### Gerador de Memorando HTML

Arquivos:

- `app_navegador/index.html`
- `app_navegador/styles.css`
- `app_navegador/app.js`
- `app_navegador/modelos/Memorando.html`

Funcionalidades:

- Fica acima do app de PDF na mesma pagina.
- Recebe apenas uma planilha `.xlsx`.
- Usa automaticamente o modelo `.html` salvo no projeto em `app_navegador/modelos/Memorando.html`.
- Gera um novo arquivo HTML de memorando.
- Substitui no modelo:
  - `20 de maio de 2026` pelo conteudo de `B1`.
  - `108/31/26` pelo conteudo de `D2`.
  - `015/31/26` pelo conteudo de `F2`.
  - `07 (sete)` pelo conteudo de `G2`, com numero por extenso.
  - Se `G2` estiver vazio, usa `G1` como fallback porque a planilha de exemplo enviada tinha a quantidade em `G1`.
  - A lista de pelotoes pela lista de `E1`.
  - O mes de referencia pelo conteudo de `G3`.
  - `GEAZI DOS SANTOS RODRIGUES` pelo conteudo de `G7`.
  - `1º Ten PM Cmt 1ª Cia Es` pelo conteudo de `F7`.

### Versao desktop em Python

Arquivos:

- `unir_documentos_pdf.py`
- `abrir_programa.bat`
- `requirements.txt`

Funcionalidades:

- Selecionar varias imagens.
- Ordenar imagens.
- Remover imagens.
- Gerar PDF.
- Instalar `Pillow` automaticamente pelo `.bat`, se necessario.

### Versao app de navegador

Arquivos:

- `app_navegador/index.html`
- `app_navegador/styles.css`
- `app_navegador/app.js`
- `abrir_app_navegador.bat`

Funcionalidades:

- Funciona direto no navegador.
- Processa tudo localmente, sem enviar imagens para servidor.
- Permite adicionar ou arrastar fotos.
- Reordenar paginas.
- Girar imagens.
- Escolher tamanho de pagina: A4 ou Carta.
- Escolher margem.
- Ajustar qualidade da imagem.
- Baixar o PDF final.

## Preparacao para GitHub

Arquivos adicionados:

- `README.md`
- `.gitignore`
- `index.html`

O `index.html` da raiz redireciona para:

```text
app_navegador/index.html
```

Assim, o projeto pode ser publicado no GitHub Pages usando:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/root`

## Ideias para proximas melhorias

- Cortar bordas automaticamente.
- Melhorar contraste/clarear documentos.
- Detectar orientacao automaticamente.
- Adicionar pre-visualizacao maior da pagina.
- Permitir arrastar para reorganizar com mais fluidez.
- Adicionar modo preto e branco.
- Permitir escolher entre PDF compacto ou alta qualidade.
- Salvar configuracoes usadas recentemente.
- Compactar imagens grandes antes de gerar PDF.
- Criar versao PWA instalavel no celular/computador.
- Adicionar suporte para captura pela camera.

### Gerador do despacho geral

Foi adicionado entre o gerador de memorando e o juntador de fotos.

Entradas:

- Planilha `.xlsx`.
- Modelo `.html` do despacho.

Saida:

- `despacho_geral.html` por padrao, com nome editavel pelo usuario.

Regras:

- Blocos ativos em `E4`, `E44`, `E84`, `E124`, `E164`, `E204`, `E244`, `E284`.
- Se o valor da celula ativa do bloco for `-`, ignora o bloco.
- Para cada bloco ativo, usa intervalos:
  - `D(n):D(n+10)` como `Al Of PM`.
  - `E(n):E(n+10)` como `RE`.
  - `Q(n):Q(n+10)` como `Nº Processo`.
- `n` comeca em `10`, termina em `290`, contando de `40` em `40`.
- Gera lista no formato:
  - `1)Nº do processo [Nº Processo], Cad PM [RE] [AL OF PM];`
  - O ultimo item nao recebe `;`.
- Substitui `015/31/26` por `F2`.
- Substitui `20/05/2026` por `B1`.
- Remove o conteudo abaixo do ultimo `CAD PM Resp. Restr/Conval/LTS`.

### Gerador de controle DOCX

O gerador HTML de controle foi substituido pelo programa antigo criado em 19 de maio, que gera controle em Word `.docx`.

Projeto usado:

- `C:\Users\higoo\Documents\Codex\2026-05-19\files-mentioned-by-the-user-planilha\programa_controle`

Arquivos principais:

- `web_app.py`
- `gerar_controle.py`
- `modelo_controle.docx`

Integracao atual:

- O app principal em `http://127.0.0.1:8770/app_navegador/index.html` incorpora o gerador DOCX antigo em um iframe.
- O gerador DOCX antigo roda em `http://127.0.0.1:8080/`.
- `iniciar_localhost.ps1` tenta subir o servidor antigo em `8080` caso ele ainda nao esteja ativo, e depois sobe o app principal em `8770`.

## Observacoes

O app de navegador e a versao principal para GitHub.

A versao Python ficou como alternativa local/desktop.
