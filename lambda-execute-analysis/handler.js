'use strict';

const fetch = require("node-fetch");
const { env } = require("process");
const aws = require('aws-sdk')
const sns = new aws.SNS({ region: 'sa-east-1' })
const ddb = new aws.DynamoDB({apiVersion: '2012-08-10', region: 'sa-east-1'});

const publishSnsTopic = async (subject, data) => {
  const params = {
    Subject: subject,
    Message: data,
    TopicArn: `arn:aws:sns:sa-east-1:196439546156:${env.SNSTopic}`
  }
  return sns.publish(params).promise()
}

const buildTextMessage = (ativo_long, ativo_short, ativo_long_price, ativo_short_price, ativo_long_horario, ativo_short_horario, fator_calculado, flag_entrada) => {
  return `
    Avaliação operação Long ${ativo_long} x Short ${ativo_short}
    Preço ${ativo_long} = ${ativo_long_price}
    Horário de atualização ${ativo_long} = ${ativo_long_horario}
    Preço ${ativo_short} = ${ativo_short_price}
    Horário de atualização ${ativo_short} = ${ativo_short_horario}
    Fator calculado = ${fator_calculado}
    Sinal de ${flag_entrada ? 'entrada' : 'saída'} ATIVADO
    `
}

const marca_aviso_efetuado = (id_dynamodb) => {

  var params = {
    TableName: env.DynamodbTable,
    Key:{
        "id": 
          {
            S: id_dynamodb
          }
    },
    UpdateExpression: "set flg_acionou_aviso_entrada = :x",
    ExpressionAttributeValues:{
        ":x": 
        {
          BOOL: true
        }
    },
    ReturnValues:"UPDATED_NEW"
  };

  console.log("Updating the item...")
  ddb.updateItem(params, function(err, data) {
      if (err) {
          console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
      } else {
          console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
      }
  })

}

exports.handler = async (event, context, callback) => {

  console.log(event)

  const flg_dose_reforco =  event.flg_dose_reforco || false

  const paramsConsultaDb = {
    TableName: env.DynamodbTable,
  };

  ddb.scan(paramsConsultaDb, function (err, data) {
    if (err) {

      console.log(`Error on retrieving data from ${env.DynamodbTable} DynamoDb table`, err);

    } else {
      
      console.log(`Success on retrieving data from ${env.DynamodbTable} DynamoDb table`);

      data.Items.forEach(async function (element, index, array) {

        console.log("Imprimindo item conforme recuperado da base");
        console.log(element);

        const id_dynamodb = element.id.S
        const ativo_long = element.ativo_long.S
        const ativo_short = element.ativo_short.S
        const flg_acionou_aviso_entrada = element.flg_acionou_aviso_entrada.BOOL
        const flg_entrada_realizada = element.flg_entrada_realizada.BOOL

        const ativo_long_response_consulta = await fetch(`https://api.hgbrasil.com/finance/stock_price?key=dcf12d06&symbol=${ativo_long}`);
        const ativo_long_data = await ativo_long_response_consulta.json();
        const ativo_long_price = ativo_long_data.results[ativo_long].price
        const ativo_long_horario = ativo_long_data.results[ativo_long].updated_at

        const ativo_short_response_consulta = await fetch(`https://api.hgbrasil.com/finance/stock_price?key=dcf12d06&symbol=${ativo_short}`);
        const ativo_short_data = await ativo_short_response_consulta.json();
        const ativo_short_price = ativo_short_data.results[ativo_short].price
        const ativo_short_horario = ativo_short_data.results[ativo_short].updated_at

        console.log('Preço ativo long: ', ativo_long_price)
        console.log('Horário de atualização do ativo long: ', ativo_long_horario)
        console.log('Preço ativo short: ', ativo_short_price)
        console.log('Horário de atualização do ativo short: ', ativo_short_horario)

        const flg_efetuar_divisao_inversa = element.flg_efetuar_divisao_inversa.BOOL
        const fator_entrada = element.fator_entrada.N
        const fator_saida = element.fator_saida.N

        let sinalEntrada, sinalSaida, fator_calculado

        if (flg_efetuar_divisao_inversa == false)
        {
          fator_calculado = ativo_long_price/ativo_short_price
          console.log('Fator Calculado: ', fator_calculado)

          //Avaliando entrada
          sinalEntrada = fator_calculado <= fator_entrada
          sinalSaida = fator_calculado >= fator_saida

        } else {
          fator_calculado = ativo_short_price/ativo_long_price
          console.log('Fator Calculado: ', fator_calculado)

          //Avaliando entrada
          sinalEntrada = fator_calculado >= fator_entrada
          sinalSaida = fator_calculado <= fator_saida
        }

        console.log('Sinal de entrada: ', sinalEntrada)
        console.log('Sinal de saída: ', sinalSaida)
        
        //Entrada execução normal (10 em 10 min atualmente)
        if (sinalEntrada && flg_acionou_aviso_entrada == false ) {
          console.log(`Sinal de ENTRADA Long ${ativo_long} x Short ${ativo_short} ATIVADO`)
          const textMessage = buildTextMessage(ativo_long, ativo_short, ativo_long_price, ativo_short_price, ativo_long_horario, ativo_short_horario, fator_calculado, true)
          await publishSnsTopic(`Sinal de ENTRADA Long ${ativo_long} x Short ${ativo_short} ATIVADO`, textMessage)
          marca_aviso_efetuado(id_dynamodb)
        }

        //Entrada execução reforço 
        if (sinalEntrada && flg_dose_reforco) {
          console.log(`Sinal de ENTRADA REFORÇO Long ${ativo_long} x Short ${ativo_short} ATIVADO`)
          const textMessage = buildTextMessage(ativo_long, ativo_short, ativo_long_price, ativo_short_price, ativo_long_horario, ativo_short_horario, fator_calculado, true)
          await publishSnsTopic(`Sinal de ENTRADA REFORÇO Long ${ativo_long} x Short ${ativo_short} ATIVADO`, textMessage)
        }

        if (sinalSaida && flg_entrada_realizada) {
          console.log(`Sinal de SAÍDA Long ${ativo_long} x Short ${ativo_short} ATIVADO`)
          const textMessage = buildTextMessage(ativo_long, ativo_short, ativo_long_price, ativo_short_price, ativo_long_horario, ativo_short_horario, fator_calculado, false)
          await publishSnsTopic(`Sinal de SAÍDA Long ${ativo_long} x Short ${ativo_short} ATIVADO`, textMessage)
        }

      });
    }
  });

  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
    }
  };

  callback(null, response);
};
