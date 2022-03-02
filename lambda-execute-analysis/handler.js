'use strict';

const fetch = require("node-fetch");
const { env } = require("process");
const aws = require('aws-sdk')
const sns = new aws.SNS({ region: 'sa-east-1' })
const ddb = new aws.DynamoDB({apiVersion: '2012-08-10', region: 'sa-east-1'});

async function publishSnsTopic (subject, data) {
  const params = {
    Subject: subject,
    Message: data,
    TopicArn: `arn:aws:sns:sa-east-1:196439546156:${env.Topic}`
  }
  return sns.publish(params).promise()
}

exports.handler = async (event, context, callback) => {

  console.log(event)

  const flg_dose_reforco =  event.flg_dose_reforco || false

  const paramsConsultaDb = {
    TableName: "mark47_ativos_monitorados",
  };

  ddb.scan(paramsConsultaDb, function (err, data) {
    if (err) {
      console.log("Error on retrieving data from mark47_ativos_monitorados DynamoDb table", err);
    } else {
      console.log("Success on retrieving data from mark47_ativos_monitorados DynamoDb table");
      data.Items.forEach(function (element, index, array) {
        console.log(element);
      });
    }
  });

  const PETR4_response = await fetch('https://api.hgbrasil.com/finance/stock_price?key=dcf12d06&symbol=PETR4');
  const PETR4_data = await PETR4_response.json();
  const PETR4_price = PETR4_data.results.PETR4.price
  const PETR4_horario = PETR4_data.results.PETR4.updated_at

  const PETR3_response = await fetch('https://api.hgbrasil.com/finance/stock_price?key=dcf12d06&symbol=PETR3');
  const PETR3_data = await PETR3_response.json();
  const PETR3_price = PETR3_data.results.PETR3.price
  const PETR3_horario = PETR3_data.results.PETR3.updated_at

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
    Preço PETR4 = ${PETR4_price}
    Horário de atualização PETR4 = ${PETR4_horario}
    Preço PETR3 = ${PETR3_price}
    Horário de atualização PETR3 = ${PETR3_horario}
    Fator PETR4/PETR3 calculado = ${PETR4_price / PETR3_price}
    Configurado para ativar se fator <= 1.2850
    Sinal de Entrada ATIVADO
    `

    await publishSnsTopic('Sinal de ENTRADA Long Petr3 x Short Petr4', message)
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
