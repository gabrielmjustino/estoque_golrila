# GolRila Estoques

Sistema de controle de estoque interno premium, totalmente cliente-side e preparado para deploy estático.

## Como fazer o deploy na Vercel

Por ser uma aplicação baseada inteiramente em HTML, CSS e JavaScript estáticos, este projeto é perfeitamente compatível com o **Vercel** sem precisar de nenhum servidor Node.js ou build complexo por trás.

### Método 1: Pelo GitHub (Recomendado)
1. Crie um repositório no seu GitHub.
2. Suba todos os arquivos desta pasta (`index.html`, `styles.css`, `vercel.json`, `LOGO.ico` e a pasta `js/`) para o repositório.
3. Acesse sua conta na [Vercel](https://vercel.com/) e clique em **Add New Project**.
4. Importe o repositório do GitHub que você acabou de criar.
5. Em "Framework Preset", mantenha as configurações padrão (geralmente será detectado automaticamente como **Other**).
6. Clique em **Deploy**. Sua aplicação estará online em alguns segundos!

### Método 2: Pelo Vercel CLI (Direto do Computador)
1. Instale o Vercel de forma global através do prompt de comando/terminal da pasta:
   ```cmd
   npm i -g vercel
   ```
2. Após rodar o comando acima, execute na mesma pasta (`estoque-app`):
   ```cmd
   vercel
   ```
3. Siga os passos no terminal sugerindo as configurações padrões para subir o projeto imediatamente!

## Funcionalidades Prontas:
- Login e autenticação Local
- Gestão de Multi-Usuários (Nível Admin / Nível Operador)
- Histórico Baseado em Memória de Navegador (LocalStorage)
- Cadastro de Produtos com Imagens
- Vendas com abate automático de produtos
