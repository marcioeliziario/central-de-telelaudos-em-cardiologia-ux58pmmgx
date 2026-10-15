migrate(
  (app) => {
    const templatesCol = app.findCollectionByNameOrId('report_templates')

    // Inserir os 11 Modelos de Laudo exigidos (Diretriz SBC 2022)
    const initialTemplates = [
      {
        title: 'ECG sem alterações significativas',
        category: 'Normalidade',
        rhythm: 'Ritmo sinusal regular',
        p_wave_description: 'Onda P de amplitude e duração normais, positiva em D1, D2 e aVF.',
        av_conduction: 'Condução atrioventricular preservada, intervalo PR normal.',
        iv_conduction: 'Condução intraventricular normal, morfologia e duração do QRS preservadas.',
        repolarization: 'Repolarização ventricular dentro dos limites da normalidade.',
        q_waves: 'Ausência de ondas Q patológicas.',
        description:
          'Ritmo sinusal regular. Intervalo PR normal. Complexos QRS com duração e morfologia normais, eixo elétrico preservado no plano frontal. Repolarização ventricular normal para a faixa etária.',
        conclusion: 'Eletrocardiograma dentro dos limites da normalidade.',
      },
      {
        title: 'Fibrilação atrial',
        category: 'Arritmias Supraventriculares',
        rhythm: 'Fibrilação atrial (ausência de ondas P organizadas, presença de ondas f)',
        p_wave_description:
          'Ausência de ondas P organizadas, presença de oscilações irregulares da linha de base (ondas f).',
        av_conduction: 'Resposta ventricular variável, condução atrioventricular irregular.',
        iv_conduction: 'Condução intraventricular normal (ou conforme morfologia observada).',
        repolarization:
          'Alterações secundárias da repolarização ventricular decorrentes da irregularidade do ciclo cardíaco.',
        q_waves: 'Sem ondas Q patológicas.',
        description:
          'Ausência de ondas P organizadas com linha de base exibindo ondulações finas/irregulares (ondas f). Intervalos RR totalmente irregulares caracterizando resposta ventricular variável.',
        conclusion: 'Fibrilação atrial com resposta ventricular a esclarecer clinicamente.',
      },
      {
        title: 'Flutter atrial',
        category: 'Arritmias Supraventriculares',
        rhythm: 'Flutter atrial típico (ondas F em dentes de serra)',
        p_wave_description:
          'Ondas F contínuas, regulares, em dentes de serra, tipicamente negativas nas derivações inferiores (D2, D3, aVF).',
        av_conduction: 'Condução atrioventricular com bloqueio fixo (ex: 2:1 ou 4:1) ou variável.',
        iv_conduction: 'Condução intraventricular normal.',
        repolarization: 'Distorcida pelas ondas F sobrepostas ao segmento ST-T.',
        q_waves: 'Ausência de ondas Q patológicas.',
        description:
          'Atividade atrial regular com frequência aproximada de 250 a 350 bpm (ondas F em dentes de serra bem visíveis nas derivações inferiores). Condução AV a avaliar conforme relação com QRS.',
        conclusion: 'Flutter atrial.',
      },
      {
        title: 'Bradicardia sinusal',
        category: 'Distúrbios do Ritmo',
        rhythm:
          'Ritmo sinusal com frequência cardíaca < 50 bpm (ou < 60 bpm conforme referência clínica)',
        p_wave_description:
          'Onda P sinusal, positiva em D1, D2 e aVF, com intervalo PR constante e normal.',
        av_conduction: 'Condução atrioventricular normal.',
        iv_conduction: 'Condução intraventricular preservada.',
        repolarization: 'Repolarização ventricular sem alterações significativas.',
        q_waves: 'Sem ondas Q patológicas.',
        description:
          'Ondas P de origem sinusal precedendo cada complexo QRS com relação AV 1:1, porém com frequência cardíaca inferior ao limite inferior de normalidade em repouso.',
        conclusion: 'Bradicardia sinusal.',
      },
      {
        title: 'Taquicardia sinusal',
        category: 'Distúrbios do Ritmo',
        rhythm: 'Ritmo sinusal com frequência cardíaca > 100 bpm',
        p_wave_description: 'Onda P de origem sinusal, positiva em D1, D2 e aVF.',
        av_conduction: 'Condução atrioventricular normal, relação AV 1:1.',
        iv_conduction: 'Condução intraventricular preservada.',
        repolarization:
          'Pode apresentar discreto infradesnivelamento de ST ascendente por taquicardia.',
        q_waves: 'Ausência de ondas Q patológicas.',
        description:
          'Ritmo regular originado no nó sinusal com relação AV 1:1 e frequência cardíaca superior a 100 bpm em repouso.',
        conclusion: 'Taquicardia sinusal.',
      },
      {
        title: 'Bloqueio atrioventricular de primeiro grau',
        category: 'Distúrbios de Condução Atrioventricular',
        rhythm: 'Ritmo sinusal',
        p_wave_description: 'Onda P de aspecto sinusal, conduzindo para o ventrículo.',
        av_conduction:
          'Atraso uniforme da condução AV: intervalo PR prolongado (> 200 ms no adulto), relação 1:1 constante.',
        iv_conduction: 'Condução intraventricular normal.',
        repolarization: 'Normal.',
        q_waves: 'Ausência de ondas Q patológicas.',
        description:
          'Ritmo sinusal regular. Prolongamento fixo e persistente do intervalo PR (> 200 ms no adulto), onde todas as ondas P são conduzidas aos ventrículos sem batimentos bloqueados.',
        conclusion: 'Bloqueio atrioventricular de primeiro grau (BAV 1º grau).',
      },
      {
        title: 'Bloqueio de ramo direito',
        category: 'Distúrbios de Condução Intraventricular',
        rhythm: 'Ritmo sinusal',
        p_wave_description: 'Onda P normal.',
        av_conduction: 'Condução AV normal.',
        iv_conduction:
          "QRS alargado (≥ 120 ms no BRD completo) com morfologia rsR', rSR' ou R amplo em V1-V2, e onda S empastada e ampla em D1 e V6.",
        repolarization:
          'Onda T invertida assimétrica e desnivelamento de ST opostos ao retardo final do QRS em derivações direitas.',
        q_waves: 'Ausência de ondas Q patológicas.',
        description:
          "Alargamento do complexo QRS com atraso final da ativação ventricular direita. Morfologia em rSR' em V1/V2 e onda S larga em D1, aVL e V6. Alterações secundárias da repolarização ventricular.",
        conclusion: 'Bloqueio completo do ramo direito (BRD).',
      },
      {
        title: 'Bloqueio de ramo esquerdo',
        category: 'Distúrbios de Condução Intraventricular',
        rhythm: 'Ritmo sinusal',
        p_wave_description: 'Onda P normal ou com sobrecarga atrial esquerda associada.',
        av_conduction: 'Condução atrioventricular normal.',
        iv_conduction:
          'QRS com duração ≥ 120 ms no adulto; ausência de onda Q em D1, aVL e V6; ondas R largas e entalhadas no ápice em D1, aVL, V5 e V6; complexos rS ou QS profundos em V1 e V2.',
        repolarization:
          'Segmento ST e onda T com polaridade oposta à deflexão principal do QRS (alteração secundária típica da repolarização).',
        q_waves: 'Sem onda q septal em derivações esquerdas (D1, aVL, V5, V6).',
        description:
          'Distúrbio avançado da condução intraventricular esquerda. Duração aumentada do QRS com apagamento do vetor septal inicial e empastamento de ondas R nas derivações esquerdas, com alterações secundárias da repolarização.',
        conclusion:
          'Bloqueio completo do ramo esquerdo (BRE). Recomenda-se correlação clínica cardiológica imediata se início recente/sintomático.',
      },
      {
        title: 'Hemibloqueio anterior esquerdo',
        category: 'Distúrbios de Condução Intraventricular',
        rhythm: 'Ritmo sinusal regular',
        p_wave_description: 'Onda P normal.',
        av_conduction: 'Condução AV normal.',
        iv_conduction:
          'Desvio acentuado do eixo elétrico do QRS para a esquerda (além de -30° no plano frontal), com morfologia rS em D2, D3 e aVF e qR em D1 e aVL; duração do QRS normal ou pouco aumentada (< 120 ms).',
        repolarization: 'Sem alterações primárias.',
        q_waves: 'Pequena onda q em D1 e aVL.',
        description:
          'Desvio significativo do eixo elétrico para o quadrante superior esquerdo (-30° a -90°). Morfologia padrão rS em derivações inferiores (D2, D3, aVF) e qR em derivações superiores (D1, aVL), com duração do QRS < 120 ms.',
        conclusion:
          'Bloqueio divisional anterossuperior esquerdo (BDAS / Hemibloqueio anterior esquerdo).',
      },
      {
        title: 'Extrassístoles ventriculares',
        category: 'Arritmias Ventriculares',
        rhythm: 'Ritmo de base sinusal intercalado por batimentos ectópicos prematuros',
        p_wave_description:
          'Ondas P sinusais presentes no ritmo de base. Batimentos ectópicos desprovidos de onda P precedente.',
        av_conduction:
          'Condução AV normal para os batimentos sinusais; pausa compensatória completa após a extrassístole.',
        iv_conduction:
          'Complexos ventriculares ectópicos prematuros com QRS largo, bizarro e de polaridade invertida à repolarização.',
        repolarization: 'Onda T da extrassístole de sentido oposto ao complexo QRS ectópico.',
        q_waves: 'Sem ondas Q patológicas nos batimentos sinusais.',
        description:
          'Presença de despolarizações ventriculares ectópicas prematuras caracterizadas por complexos QRS alargados e bizarros, não precedidos por onda P, seguidos por pausa compensatória.',
        conclusion:
          'Extrassístoles ventriculares isoladas (quantificar frequência e morfologia no traçado).',
      },
      {
        title: 'Alterações inespecíficas da repolarização ventricular',
        category: 'Repolarização Ventricular',
        rhythm: 'Ritmo sinusal',
        p_wave_description: 'Onda P normal.',
        av_conduction: 'Condução AV normal.',
        iv_conduction: 'Condução intraventricular normal.',
        repolarization:
          'Achatamento ou inversão rasa de onda T e/ou discretos desnivelamentos do segmento ST que não preenchem critérios diagnósticos específicos para isquemia ou sobrecarga.',
        q_waves: 'Ausência de ondas Q patológicas.',
        description:
          'Alterações da fase de repolarização ventricular caracterizadas por retificação do segmento ST ou variações morfológicas da onda T (achatamento ou inversão discreta assimétrica) sem caracterizar lesão transmural aguda ou isquemia típica.',
        conclusion:
          'Alterações inespecíficas da repolarização ventricular. Interpretar à luz do quadro clínico e exames laboratoriais.',
      },
    ]

    for (const tpl of initialTemplates) {
      try {
        app.findFirstRecordByData('report_templates', 'title', tpl.title)
      } catch (_) {
        const r = new Record(templatesCol)
        r.set('title', tpl.title)
        r.set('category', tpl.category)
        r.set('rhythm', tpl.rhythm)
        r.set('p_wave_description', tpl.p_wave_description)
        r.set('av_conduction', tpl.av_conduction)
        r.set('iv_conduction', tpl.iv_conduction)
        r.set('repolarization', tpl.repolarization)
        r.set('q_waves', tpl.q_waves)
        r.set('description', tpl.description)
        r.set('conclusion', tpl.conclusion)
        r.set('is_active', true)
        app.save(r)
      }
    }
  },
  (app) => {
    // Reverter seeds de modelos
  },
)
