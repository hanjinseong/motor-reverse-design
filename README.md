# Motor Reverse Design — Multi-Agent Non-parametric IPMSM Design Console

Live demo for **Multi-Agent based Non-parametric Motor Design Optimization** (research 02 on <https://hanjinseong.github.io/>).
Sibling of the parametric console at <https://hanjinseong.github.io/ipmsm-design/>.

LLM agents breed IPMSM **rotor images** (not geometry parameters) in an evolutionary loop:

- **Design agent** — chats the problem into a *Design Problem Card*: reference image, rotor/stator envelope, objectives (iron loss ↓, torque ↑).
- **Generation agent** — parents = Pareto front of the FEA archive (NSGA-II sort + crowding); *exploration* arm (zero-shot Qwen-Image-2.1 + one topology move sentence, shares from an operator scoreboard via Thompson sampling) and *exploitation* arm (fine-tuned editor with library / transfer directions); feasibility gate; N11 multimodal embedding + farthest-point filtering → 60 designs.
- **Evaluation agent** — RGB → binary → STEP → Maxwell 2D FEA; CNN deep-ensemble surrogate with active learning; ε-dominance vs the parent; improvement directions; operator scoreboard update.
- **GA campaign** — 5 generations × 60 FEA on Nabla_25838, Pareto front and hypervolume.

Every number and image in the console comes from the real `test3_ga_full_nabla25838` campaign (`assets/data.js`, 300 FEA evaluations; thumbnails in `assets/d/`).

Static site — no build step. `index.html` + `assets/{style.css, i18n.js, app.js, data.js}`. English by default, KO toggle (stored in `localStorage['motorai-rd-lang']`).

## Preview locally

```bash
python -m http.server 4181 -d .
```

then open <http://localhost:4181/>.

## Deploy

GitHub Pages, branch `main`, folder `/ (root)` → <https://hanjinseong.github.io/motor-reverse-design/>.
