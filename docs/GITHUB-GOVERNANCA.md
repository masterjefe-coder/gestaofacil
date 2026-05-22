# Governanca GitHub

Este projeto ja possui CI unico em `.github/workflows/ci.yml`.

Para fechar a protecao de merge no GitHub, configurar a branch principal com estas regras:

## Branch protection recomendada para `main`

- exigir pull request antes de merge
- exigir branch atualizada antes de merge
- exigir status checks verdes antes de merge
- bloquear push direto na `main`
- exigir pelo menos 1 review
- exigir resolucao de conversas antes do merge
- incluir administradores, se o time quiser o mesmo padrao para todos

## Status checks que devem ser obrigatorios

- `quality`

Esse e o job definido no workflow `CI`.

## Fluxo recomendado

1. Criar branch curta por tema.
2. Abrir PR com o template padrao.
3. Garantir `typecheck`, `lint`, `test` e `build` verdes.
4. Fazer review focado em comportamento, risco e aderencia ao produto real.
5. Fazer merge apenas com CI verde.

## CODEOWNERS

O arquivo `.github/CODEOWNERS` ja foi adicionado para centralizar revisao das areas mais sensiveis:

- `app/api`
- `lib`
- `prisma`
- `next.config.ts`
