# Go Live Checklist

## Pronto no produto

- login, onboarding e setup de workspace
- clientes, orcamentos e cobrancas
- pedidos como fila operacional explicita
- relatorios em tela, Excel e PDF
- WhatsApp via Evolution API
- cobrancas com Asaas e webhook
- fila fiscal e tentativa de emissao NFS-e nacional

## Validar antes de abrir para clientes reais

- rodar `npm run readiness` no ambiente alvo e fechar qualquer `FAIL`
- tratar tambem os `WARN` de `NFS-e` quando o municipio alvo ainda nao estiver liberado no Emissor Nacional
- conectar a primeira conta ou subconta Asaas real por workspace
- criar uma cobranca real e confirmar que o dinheiro cai na conta certa
- validar webhook do Asaas com recebimento real
- validar envio e retorno real no WhatsApp
- validar emissao NFS-e ponta a ponta no municipio piloto
- revisar onboarding documental da subconta Asaas

## Bloqueadores para produção ampla

- primeira validacao real de Asaas por workspace
- primeira validacao real de NFS-e completa em municipio com `AderenteEmissorNacional = Sim`
- testes operacionais reais de WhatsApp em rotina

## Recomendacao de rollout

1. piloto interno
2. um cliente real controlado
3. poucos workspaces com acompanhamento manual
4. abertura gradual depois das validacoes
