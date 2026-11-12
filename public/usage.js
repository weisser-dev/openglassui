window.formatUsage=function(data){
 const rows=['Verbrauch / Kontext']; const number=value=>Number.isFinite(value)?new Intl.NumberFormat('de-DE').format(value):null;
 if(data.provider==='codex'){const total=data.tokenUsage?.total || {},windowSize=data.tokenUsage?.modelContextWindow;for(const [label,value] of [['Eingabe',total.inputTokens],['Ausgabe',total.outputTokens],['Gesamt',total.totalTokens],['Kontextfenster',windowSize]])if(number(value)!==null)rows.push(`${label}: ${number(value)} Tokens`);}
 else if(data.provider==='claude'){for(const [label,value] of [['Eingabe',data.usage?.input_tokens],['Ausgabe',data.usage?.output_tokens]])if(number(value)!==null)rows.push(`${label}: ${number(value)} Tokens`);if(Number.isFinite(data.costUsd))rows.push(`Gemeldete Kosten: $${data.costUsd.toFixed(4)}`);}
 else if(data.provider==='kiro'){if(Number.isFinite(data.context?.usagePercentage))rows.push(`Kontext: ${data.context.usagePercentage.toFixed(1)} %`);if(data.turn?.promptTurnSummaries)rows.push(`Abrechnung (Kiro): ${JSON.stringify(data.turn.promptTurnSummaries)}`);}
 if(rows.length===1)rows.push('Keine detaillierten Angaben vom Agenten verfügbar.');return rows.join('\n');
};
