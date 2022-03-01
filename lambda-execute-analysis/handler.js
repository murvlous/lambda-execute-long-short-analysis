'use strict';

const fetch = require("node-fetch");
const { env } = require("process");
const aws = require('aws-sdk')
const sns = new aws.SNS({ region: 'sa-east-1' })

async function publishSnsTopic (subject, data) {
  const params = {
    Subject: subject,
    Message: data,
    TopicArn: `arn:aws:sns:sa-east-1:196439546156:${env.Topic}`
  }
  return sns.publish(params).promise()
}

exports.handler = async (event, context, callback) => {

  const PETR4_response = await fetch('https://api.hgbrasil.com/finance/stock_price?key=dcf12d06&symbol=PETR4');
  const PETR4_data = await PETR4_response.json();
  const PETR4_price = PETR4_data.results.PETR4.price

  const PETR3_response = await fetch('https://api.hgbrasil.com/finance/stock_price?key=dcf12d06&symbol=PETR3');
  const PETR3_data = await PETR3_response.json();
  const PETR3_price = PETR3_data.results.PETR3.price

  //Avaliando Long Petr4 x Short Petr3

  let sinalEntradaLongPetr4 = false;
  if (PETR4_price/PETR3_price <= 0.9060) {
    sinalEntradaLongPetr4 = true
    const message = {
      body: JSON.stringify({
        message: 'Avaliando Operação Long Petr4 x Short Petr3',
        preco_PETR4: PETR4_price,
        preco_PETR3: PETR3_price,
        fator_PETR4_PETR3: PETR4_price / PETR3_price,
        sinalEntradaLongPetr4
      })
    }
    
    await publishSnsTopic('Entrada Long Petr4 x Short Petr3', message)
  }

  let sinalSaidaLongPetr4 = false;
  if (PETR4_price/PETR3_price >= 0.9350) {
    sinalSaidaLongPetr4 = true
    const message = {
      body: JSON.stringify({
        message: 'Avaliando Operação Long Petr4 x Short Petr3',
        preco_PETR4: PETR4_price,
        preco_PETR3: PETR3_price,
        fator_PETR4_PETR3: PETR4_price / PETR3_price,
        sinalSaidaLongPetr4
      })
    }
    
    await publishSnsTopic('Saída Long Petr4 x Short Petr3', message)
  }

  //Avaliando Long Petr3 x Short Petr4

  let sinalEntradaLongPetr3 = false;
  if (PETR4_price/PETR3_price <= 1.2850) {
    sinalEntradaLongPetr3 = true
    const message = `
    Avaliando Operação Long Petr3 x Short Petr4
    Preco PETR4 = ${PETR4_price}
    Preco PETR3 = ${PETR3_price}
    Fator PETR4/PETR3 calculado = ${PETR4_price / PETR3_price}
    Fator PETR4/PETR3 configurado <= 1.2850
    Sinal de Entrada ATIVADO
    `

    await publishSnsTopic('Entrada Long Petr3 x Short Petr4', message)
  }

  let sinalSaidaLongPetr3 = false;
  if (PETR4_price/PETR3_price >= 1.0000) {
    sinalSaidaLongPetr3 = true
    const message = {
      body: JSON.stringify({
        message: 'Avaliando Operação Long Petr3 x Short Petr4',
        preco_PETR4: PETR4_price,
        preco_PETR3: PETR3_price,
        fator_PETR4_PETR3: PETR4_price / PETR3_price,
        sinalSaidaLongPetr3
      })
    }
    
    await publishSnsTopic('Saída Long Petr3 x Short Petr4', message)
  }

  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
    },
    body: JSON.stringify({
      message: 'Avaliando Operação Long Petr4 x Short Petr3',
      preco_PETR4: PETR4_price,
      preco_PETR3: PETR3_price,
      fator_PETR4_PETR3: PETR4_price / PETR3_price,
      sinalEntradaLongPetr4,
      sinalSaidaLongPetr4,

      message2: 'Avaliando Operação Long Petr3 x Short Petr4',
      preco_PETR3_: PETR3_price,
      preco_PETR4_: PETR4_price,
      fator_PETR4_PETR3_: PETR4_price / PETR3_price,
      sinalEntradaLongPetr3,
      sinalSaidaLongPetr3,
    }),
  };

  callback(null, response);
};