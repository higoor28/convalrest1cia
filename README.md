# Ferramentas para a Missão Conval./Rest./Lic. comp./LTS/AO

Aplicação estática preparada para publicação no GitHub Pages. Não requer servidor, banco de dados ou instalação de dependências.

## Como publicar

1. No GitHub, crie um repositório novo.
2. Extraia o arquivo ZIP deste projeto.
3. Envie **o conteúdo da pasta extraída** para a raiz do repositório. O arquivo `index.html` deve ficar na raiz.
4. No repositório, abra **Settings > Pages**.
5. Em **Build and deployment**, escolha **Deploy from a branch**.
6. Selecione a branch **main**, a pasta **/(root)** e clique em **Save**.
7. Aguarde a publicação. O endereço normalmente será:

   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`

## Estrutura necessária

- `index.html`: página inicial.
- `app.js`: regras dos geradores.
- `styles.css`: aparência do site.
- `unificador_controles.js` e `unificador_despachos.js`: ferramentas de unificação.
- `modelos/`: modelos utilizados para gerar os documentos.
- imagens `.png`: identidade visual.
- `.nojekyll`: instrui o GitHub Pages a publicar os arquivos diretamente.

## Observações importantes

- Os arquivos enviados pelo usuário são processados no próprio navegador; esta aplicação não possui backend.
- O GitHub Pages publica o repositório como site estático. Se o repositório for público, seu código e seus modelos também serão públicos.
- A tela de senha do site é uma barreira feita no navegador e não substitui autenticação segura de servidor. Não use o site para armazenar dados sigilosos.
- Para testar localmente, use um servidor HTTP. Abrir `index.html` diretamente pelo Explorador pode impedir o carregamento dos modelos por causa das restrições do navegador.

## Atualização aplicada no memorando

O remetente é obtido da célula `F7` da planilha. Quando houver hífen, o documento usa apenas o texto posterior ao primeiro hífen. Exemplo: `Cap PM - Cmt da 1ª Cia Es` gera `Do Cmt da 1ª Cia Es`.
