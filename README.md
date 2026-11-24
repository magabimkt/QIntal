# QIntal — Bateria cognitiva

*O quintal onde a mente brinca.*

Bateria de autoconhecimento cognitivo baseada no modelo CHC (Cattell-Horn-Carroll), com quatro etapas:

| Etapa | Domínio | Tarefa | Régua de comparação |
|---|---|---|---|
| 1 | Raciocínio fluido (Gf) | Matrizes 3×3 geradas por regras, teste adaptativo (TRI) | MaRs-IB (Zorowitz et al., 2024), 1.501 adultos, com ajuste por idade |
| 2 | Memória de trabalho (Gwm) | Span de dígitos, ordem direta e inversa | TestMyBrain (Singh et al., 2021) |
| 3 | Memória visuoespacial (Gwm) | Blocos de Corsi | Kessels et al. (2000) |
| 4 | Velocidade de processamento (Gs) | Pareamento símbolo-dígito, 90 s | TestMyBrain (Singh et al., 2021) |

**Sem validade clínica.** Uso pessoal e de autoconhecimento. Não substitui avaliação psicológica.

---

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | O app inteiro (telas, testes, pontuação) |
| `manifest.json` | Permite instalar o app no celular |
| `sw.js` | Faz o app funcionar sem internet |
| `icon.svg`, `icon-192.png`, `icon-512.png` | Ícones do app |
| `firebase-config.js` | Configuração do Firebase (vazia = só salva no aparelho) |
| `firebase-sync.js` | Login com Google e sincronização com a nuvem |
| `firestore.rules` | Regras de segurança do banco de dados |

---

## 1. Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (por exemplo, `qintal`).
2. Envie **todos os arquivos** desta pasta para a raiz do repositório (*Add file → Upload files*).
3. Vá em **Settings → Pages**.
4. Em *Source*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**. Salve.
5. Em alguns minutos o app estará em `https://SEU-USUARIO.github.io/qintal/`.

Para instalar no celular: abra o endereço no navegador e use **Adicionar à tela inicial**.

---

## 2. Ativar o Firebase (opcional)

Sem o Firebase, os resultados ficam salvos só no aparelho. Com ele, ficam na sua conta Google e aparecem em qualquer aparelho.

### 2.1 Criar o projeto
1. Acesse **console.firebase.google.com** e clique em **Adicionar projeto**.
2. Dê um nome (por exemplo, `qintal`). O Google Analytics pode ficar desativado.

### 2.2 Registrar o app da Web
1. Na página do projeto, clique no ícone **</>** (Web).
2. Dê um apelido (por exemplo, `qintal-web`). Não precisa marcar o Firebase Hosting.
3. Copie os valores do objeto `firebaseConfig` que aparecer.
4. Cole esses valores em **`firebase-config.js`**, no lugar das aspas vazias.

### 2.3 Ativar o login com Google
1. Menu **Build → Authentication → Get started**.
2. Aba **Sign-in method → Google → Ativar**. Escolha o e-mail de suporte e salve.
3. Aba **Settings → Authorized domains → Add domain**.
4. Adicione **`SEU-USUARIO.github.io`**.

### 2.4 Criar o banco de dados
1. Menu **Build → Firestore Database → Create database**.
2. Escolha uma localização (por exemplo, `southamerica-east1`, em São Paulo).
3. Comece em **modo de produção**.
4. Na aba **Rules**, apague o conteúdo e cole o conteúdo de **`firestore.rules`**. Clique em **Publish**.

### 2.5 Enviar a configuração
Suba o `firebase-config.js` preenchido para o GitHub, no lugar do antigo. Na tela inicial do app vai aparecer o cartão **Salvar na nuvem**, com o botão **Entrar com Google**.

Ao entrar pela primeira vez, os resultados que já estavam no aparelho são enviados para a sua conta. Nada se perde.

> Os valores de `firebase-config.js` não são senhas: o Firebase foi feito para que eles fiquem visíveis no site. Quem protege os dados são as regras do Firestore, que deixam cada pessoa ver só os próprios resultados.

---

## 3. Atualizar o app depois

Sempre que alterar arquivos, abra `sw.js` e aumente a versão na linha:

```js
const CACHE = 'qintal-v1';
```

(por exemplo, para `qintal-v2`). Assim, os aparelhos baixam a versão nova.

---

## Referências principais

- Zorowitz, S., Chierchia, G., Blakemore, S.-J., & Daw, N. D. (2024). An item response theory analysis of the matrix reasoning item bank (MaRs-IB). *Behavior Research Methods, 56*(3), 1104–1122.
- Carpenter, P. A., Just, M. A., & Shell, P. (1990). What one intelligence test measures. *Psychological Review, 97*(3), 404–431.
- Singh, S., et al., & Germine, L. (2021). The TestMyBrain Digital Neuropsychology Toolkit. *Journal of Clinical and Experimental Neuropsychology, 43*(8), 786–795.
- Kessels, R. P. C., et al. (2000). The Corsi Block-Tapping Task: Standardization and normative data. *Applied Neuropsychology, 7*(4), 252–258.
- Schneider, W. J., & McGrew, K. S. (2012). The Cattell-Horn-Carroll model of intelligence. In *Contemporary Intellectual Assessment* (3rd ed.). Guilford.
- Zimmermann, N., et al. (2015). Brazilian preliminary norms… Digit Span test in adults. *Dementia & Neuropsychologia, 9*(2), 120–127.
