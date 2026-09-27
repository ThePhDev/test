# ARISE: Mais Forte a Cada Dia

RPG 2D de ação e progressão inspirado em *Solo Leveling*, feito com o personagem da folha de sprites (`assets/`). Roda direto no navegador, sem dependências.

## Como jogar
Sirva a pasta com um servidor local (ex.: `python3 -m http.server`) e acesse `http://localhost:8000`.

| Ação | Teclado | Celular |
|---|---|---|
| Mover | WASD / setas | arrastar no lado esquerdo |
| Atacar | automático | automático |
| Domínio Sombrio (área, 30 MP) | Espaço | botão DOMÍNIO |
| Investida (invulnerável) | Shift | botão INVESTIDA |
| ARISE (extrair sombra) | E | botão ARISE |
| Pausa | Esc / P | botão II |

## Sistemas
- **Gates** de rank E a S gerados por RNG: Gate Vermelho (x3, sem fuga), Gate do Tesouro (ouro x5), Dungeon Dupla (segundo chefe), Fenda Instável (+20 níveis, x6).
- **Níveis e ranks**: +5 pontos de atributo por nível (FOR, AGI, VIT, INT, PER), reavaliação de rank E → D → C → B → A → S → SS → Monarca.
- **Loot** com 6 raridades (Comum a Mítico), feixes de luz, câmera lenta nos lendários, auto-equipar, aprimoramento +N com chance de falha.
- **ARISE**: extraia sombras de inimigos derrotados (3 tentativas, com chance crescente). Chefes viram sombras nomeadas (Igris, Beru, Kargalgan...). As sombras lutam ao seu lado e sobem de nível.
- **Combo** com bônus de EXP, missões de urgência aleatórias, **Missão Diária** com sequência de dias, **Caixa Aleatória** com roleta, títulos.
- Progresso salvo no `localStorage` do navegador.

## Arquivos
- `index.html`: interface e estilos
- `game.js`: motor do jogo
- `assets/`: sprites e retratos extraídos da arte do personagem
