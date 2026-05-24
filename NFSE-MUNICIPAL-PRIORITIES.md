# NFSE Municipal Priorities

## Data de referencia

2026-05-24

## Objetivo

Definir a primeira leva de municipios a integrar por API municipal quando a NFS-e Nacional nao estiver liberada no Emissor Nacional publico.

## Regra de produto

1. o projeto deve priorizar `NFS-e Nacional`
2. se o municipio estiver liberado no Emissor Nacional, manter `provider = national`
3. se o municipio nao estiver liberado no Emissor Nacional e existir provider municipal suportado, usar `fallback municipal`
4. novas integracoes municipais devem entrar apenas como cobertura complementar, nunca substituindo a estrategia `national-first`

## Fonte oficial usada

- monitoramento oficial: https://www.gov.br/nfse/pt-br/municipios/monitoramento-adesoes
- planilha oficial atual: https://www.gov.br/nfse/pt-br/municipios/monitoramento-adesoes/municipiosaderentes202600514.xlsx

Leitura usada para este documento:

- municipios com `AtivoNaBase = Sim`
- municipios com `AderenteEmissorNacional = Nao`
- ordenacao principal por populacao

## Provider municipal ja integrado

- `Joinville/SC`
  - provider: `NF-em Joinville`
  - papel no produto: fallback municipal quando o fluxo nacional nao estiver liberado

## Primeira leva recomendada

Estas sao as 15 cidades que mais fazem sentido no primeiro momento, priorizando mercado potencial e gap atual no Emissor Nacional:

1. `Sao Paulo/SP`
2. `Brasilia/DF`
3. `Fortaleza/CE`
4. `Salvador/BA`
5. `Goiania/GO`
6. `Belem/PA`
7. `Guarulhos/SP`
8. `Campinas/SP`
9. `Maceio/AL`
10. `Campo Grande/MS`
11. `Teresina/PI`
12. `Joao Pessoa/PB`
13. `Duque de Caxias/RJ`
14. `Nova Iguacu/RJ`
15. `Sao Bernardo do Campo/SP`

## Ordem pratica sugerida

Para execucao, faz mais sentido quebrar assim:

### Onda 1

- `Sao Paulo/SP`
- `Brasilia/DF`
- `Fortaleza/CE`
- `Salvador/BA`
- `Goiania/GO`

### Onda 2

- `Belem/PA`
- `Guarulhos/SP`
- `Campinas/SP`
- `Maceio/AL`
- `Campo Grande/MS`

### Onda 3

- `Teresina/PI`
- `Joao Pessoa/PB`
- `Duque de Caxias/RJ`
- `Nova Iguacu/RJ`
- `Sao Bernardo do Campo/SP`

## Criterios de priorizacao

- populacao e tamanho de mercado
- relevancia comercial para pequenos negocios de servico
- cobertura geografica
- probabilidade de existir integracao municipal aproveitavel
- capacidade de gerar fallback real enquanto a NFS-e Nacional nao cobre tudo

## O que validar por municipio antes de implementar

1. existe webservice oficial ou API municipal documentada?
2. existe ambiente de homologacao ou testes?
3. o municipio exige SOAP, REST, certificado A1, login por usuario, token ou credencial propria?
4. a prefeitura publica WSDL, XSD, manual tecnico e exemplos?
5. a emissao automatica pode ser feita por ERP de terceiro sem portal humano?

## Decisao para o projeto

- manter `NFS-e Nacional` como espinha dorsal
- manter `Joinville` como primeiro fallback municipal real
- abrir novas integracoes municipais nesta ordem de prioridade
- atacar primeiro os municipios com maior impacto comercial e documentacao mais acessivel

## Comando de apoio

Para revisar a fila oficial atual de oportunidades:

```bash
npm run nfse:municipal-priority -- --limit 20
```

## Observacao importante

Esta lista nao significa que todos esses municipios estejam prontos para integracao imediata. Ela representa a fila recomendada para pesquisa tecnica e implementacao, usando a base oficial da NFS-e como criterio inicial.
