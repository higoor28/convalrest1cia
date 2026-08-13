# Memorando HTML e Unir Fotos em PDF

Aplicativo web simples para gerar um memorando HTML a partir de uma planilha `.xlsx` e tambem juntar varias fotos de documentos em um unico arquivo PDF.

O processamento acontece no proprio navegador. Os arquivos nao sao enviados para nenhum servidor.

## Acesso ao programa

O programa solicita somente uma senha, sem identificacao de usuario. A senha
compartilhada e validada diretamente no navegador por um verificador PBKDF2
incorporado ao site, sem banco de dados ou servidor de autenticacao. O acesso
fica registrado neste navegador por ate 8 horas.

Essa protecao e adequada apenas como barreira simples em um site estatico: o
verificador da senha faz parte dos arquivos publicados e pode ser analisado por
quem tiver acesso ao codigo-fonte.

A interface usa tema escuro com detalhes em amarelo. Quando um arquivo e gerado, o app tenta iniciar o download automaticamente e tambem mostra um link de download manual caso o navegador bloqueie a abertura automatica.


## Como usar

1. Abra o arquivo `app_navegador/index.html` no navegador.
2. Na parte superior, use **Gerar Memorando HTML** para carregar somente a planilha `.xlsx` e gerar o memorando.
3. No bloco central, use **Gerador do despacho geral** para carregar a planilha `.xlsx` e o modelo `.html` do despacho.
4. Use **Gerador de Controle DOCX ou HTML** para transformar `.xlsx` em controle Word ou HTML no proprio app.
5. Use **Unificador de Controles HTML** para reunir dois ou mais controles em um unico arquivo HTML.
6. Na parte inferior, use **Unir fotos em PDF** para juntar imagens em um PDF.

No Windows, tambem e possivel abrir pelo arquivo:

```bat
abrir_app_navegador.bat
```

Esse atalho inicia um pequeno servidor local e abre o app em `http://127.0.0.1:8765/app_navegador/index.html`.

## Gerador de Memorando HTML

O gerador usa o modelo em:

```text
app_navegador/modelos/Memorando.html
```

O usuario nao precisa selecionar o arquivo HTML. O modelo fica salvo dentro do app e e carregado automaticamente.

Valores lidos da planilha:

| Celula | Uso no memorando |
| --- | --- |
| `B1` | Data no trecho `20 de maio de 2026` |
| `D2` | Numero do memorando no trecho `108/31/26` |
| `F2` | Numero do despacho no trecho `015/31/26` |
| `G1` | Quantidade usada no trecho `1 planilha com [G1] controles.` |
| `E1` | Lista de pelotoes |
| `G4` | Periodo de referencia; o nome do mes e extraido e inserido depois de `referentes ao mes de` |
| `G7` | Nome da assinatura |
| `F7` | Cargo/função da assinatura |

Exemplo para `G1 = 5`:

```text
1 planilha com 5 controles.
```

## Unir Fotos em PDF

1. Clique em **Adicionar fotos** ou arraste as imagens para a area indicada.
2. Ajuste a ordem das paginas, gire imagens se precisar e escolha as opcoes do PDF.
3. Clique em **Gerar PDF** para baixar o arquivo final.

## Gerador do despacho geral

O gerador le os blocos da planilha seguindo este padrao:

- Blocos ativos: `E4`, `E44`, `E84`, `E124`, `E164`, `E204`, `E244`, `E284`.
- Se a celula do bloco ativo for `-`, o bloco correspondente e ignorado.
- Para cada bloco ativo, coleta:
  - `D(n):D(n+10)` como `Al Of PM`
  - `E(n):E(n+10)` como `RE`
  - `Q(n):Q(n+10)` como `Nº Processo`
- O `n` inicial e `10`, vai ate `290`, contando de `40` em `40`.

O HTML gerado substitui:

- `015/31/26` pelo conteudo de `F2`
- `20/05/2026` pelo conteudo de `B1`
- A lista exemplo de processos pela lista extraida da planilha

O arquivo padrao de saida e:

```text
despacho_geral.html
```

## Gerador de Controle DOCX ou HTML

O gerador de controle fica integrado ao app principal em `http://127.0.0.1:8770/`.
Ele recebe a planilha `.xlsx`, permite escolher a planilha interna de I a VIII e gera:

- `controle_preenchido.docx`
- `controle_preenchido.html`

O DOCX e gerado pelo proprio servidor local `8770`, sem depender de outro app na porta `8080`.

## Unificador de Controles HTML

O unificador fica logo abaixo do Gerador de Controle HTML. Selecione dois ou
mais controles `.html` na ordem desejada e clique em **Unificar Controles
HTML**. O processamento acontece no proprio navegador.

O primeiro arquivo e usado como modelo. O resultado preserva os registros na
ordem escolhida, mantem uma unica tabela principal e uma unica legenda e cria
separadores centralizados para identificar cada pelotao. O cabecalho da primeira
coluna e alterado de `AL OF PM` para `CAD PM`.

O cadete responsavel e escolhido automaticamente pelo pelotao de maior
prioridade: maior numero primeiro e, no mesmo numero, letra em ordem alfabetica
(`3A`, `3B`, `2A`, `2B`, `1A`...). O nome e a identificacao do pelotao na
assinatura sao atualizados no documento final. O arquivo padrao de saida e:

```text
controle_html_unificado.html
```

## Mesclador de Despachos por Pelotao

O mesclador fica logo abaixo do Gerador de Despacho por Pelotao. Selecione dois
ou mais despachos `.html` na ordem desejada e clique em **Mesclar Despachos
HTML**. Todo o processamento acontece no navegador.

O primeiro arquivo e usado como modelo do documento final. O resultado mantem
somente um cabecalho, uma introducao, um encerramento e uma assinatura. Os
afastamentos dos arquivos selecionados sao reunidos na ordem escolhida e
renumerados continuamente como `1.1.`, `1.2.`, `1.3.` e assim por diante, junto
com seus respectivos subitens. Campos automaticos repetidos sao removidos e
apenas um campo automatico e mantido ao final.

No documento unificado, o assunto passa a ser **Afastamentos dos pelotoes da
1a Cia** e a funcao do remetente e da assinatura fica sem a identificacao de um
pelotao especifico. O cadete responsavel e escolhido automaticamente pelo
pelotao mais antigo entre os arquivos: maior numero primeiro e, dentro do mesmo
numero, a letra A antes da B (`3A`, `3B`, `2A`, `2B`, `1A`...). O arquivo
padrao de saida e:

```text
despacho_pelotoes_unificado.html
```

## Gerador de Despacho do Oficial da Missao ao Cmt de Cia

A ferramenta fica abaixo do Mesclador de Despachos por Pelotao. Ela recebe uma
planilha `.xlsx`, usa as celulas `G2`, `B1`, `E1`, `G4` e `G6` da primeira aba
e gera um HTML baseado no despacho SEI fornecido. O arquivo termina na linha
`Oficial Resp. Restr./Conval./LTS/Lic. Comp./AO`, sem assinatura eletronica,
autenticacao SEI, QR code ou rodape posterior.

## Publicar no GitHub Pages

1. Crie um repositorio no GitHub.
2. Envie todos estes arquivos para o repositorio.
3. No GitHub, acesse **Settings > Pages**.
4. Em **Build and deployment**, selecione:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
5. Salve e aguarde o GitHub gerar o link.

O arquivo `index.html` da raiz redireciona automaticamente para o app em `app_navegador/index.html`.

## Estrutura

```text
.
├── index.html
├── abrir_app_navegador.bat
├── app_navegador/
│   ├── index.html
│   ├── styles.css
│   └── app.js
│   └── modelos/
│       └── Memorando.html
├── unir_documentos_pdf.py
├── abrir_programa.bat
├── requirements.txt
└── README.md
```

## Versao Python

A raiz tambem contem uma versao desktop em Python/Tkinter:

```bat
abrir_programa.bat
```

Ela usa a biblioteca `Pillow`, listada em `requirements.txt`.
