# Guia de Instalação em VPS

Este aplicativo foi preparado para rodar tanto no Google AI Studio quanto em servidores independentes (VPS).

## Requisitos
- Node.js 20+
- MySQL 8.0+
- Docker & Docker Compose (Recomendado)

## Opção 1: Usando Docker (Recomendado)

1. Clone o repositório na sua VPS.
2. Edite o arquivo `docker-compose.yml` se desejar mudar as senhas padrão.
3. Execute o comando:
   ```bash
   docker-compose up -d --build
   ```
4. O sistema estará disponível na porta `3000`.

## Opção 2: Instalação Manual

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o banco de dados MySQL usando o arquivo `schema.sql`.
3. Configure o arquivo `.env` com os dados do seu MySQL.
4. Gere a build do frontend:
   ```bash
   npm run build
   ```
5. Inicie o servidor:
   ```bash
   npm run start
   ```

## Integração Sicoob

A integração com o Sicoob está pronta para funcionar fora do ambiente Google. Certifique-se de:
1. Cadastrar seu `Client ID` e `Client Secret` no Dashboard do sistema.
2. Upload do Certificado `.pem` e da Chave Privada `.key` no Dashboard.
3. Se o Sicoob exigir IP fixo, certifique-se de que o IP da sua VPS está liberado no portal do desenvolvedor Sicoob.

## Autenticação

Para o modo VPS, o sistema utiliza JWT. O login padrão é:
- **E-mail:** `admin@admin.com`
- **Senha:** `admin123` (Configure via MySQL no primeiro acesso)
