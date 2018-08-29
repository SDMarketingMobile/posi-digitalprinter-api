var express = require('express');
var net 	 = require('net');
var router = express.Router();
var models 	= require('../models');
var Sequelize = require('sequelize');
var underscore = require("underscore");
var Op = Sequelize.Op;
var Account = models.Account;
var AccountItem = models.AccountItem;
var AccountItemAditional = models.AccountItemAditional;
var RemoteDevice = models.RemoteDevice;

function sendSocketMessage(device_ip, device_port, message_data) {
    // send payload to specific remote device with websocket connection...
    var client = new net.Socket();
        client.setTimeout(1000); // set timeout to 1 seconds...

    client.connect(device_port, device_ip, function() {
        console.log('CONNECTED TO: '+ device_ip +':'+ device_port);
        client.write(JSON.stringify(message_data));
    });
    client.on('data', function(data){
        console.log('DATA RECEIVED: '+ data);
        client.end();
        client.destroy();
    });

    client.on('close', function(){
        console.log('CONNECTION CLOSED TO: '+ device_ip +':'+ device_port);
        client.end();
        client.destroy();
    });

    client.on('error', function(){
        console.log('CONNECTION ERROR TO: '+ device_ip +':'+ device_port);
        client.end();
        client.destroy();
    }); 
}

async function sendResponse(res, account) {
    // retrieve account all items...
    var items = await account.getAccountItems();

    account = account.dataValues;

    // get conference remote device info...
    account.remoteDeviceConference = await RemoteDevice.findById(account.remote_device_conference_id);
    sendSocketMessage(
        account.remoteDeviceConference.device_ip,   
        account.remoteDeviceConference.device_port, 
        account
    );

    // looping for items to...
    for (var i = 0; i < items.length; i++) {
        items[i] = items[i].dataValues;
        items[i].aditionals = await items[i].getAccountItemAditionals();
        items[i].remoteDeviceProduction = await RemoteDevice.findById(items[i].remote_device_production_id);
    }
    
    // identifying remote devices to send account...
    var rds = underscore.groupBy(items, function(item){
        var ip = item.remoteDeviceProduction.device_ip;
        var port = item.remoteDeviceProduction.device_port;
        return ip +":"+ port;
    });

    // reorder for the major prepare time...
    var pt = underscore.map(underscore.groupBy(items, 'prepare_time'), function(items, prepare_time){
        // get remote device from first element...
        var rd_ip = items[0].remoteDeviceProduction.device_ip;
        var rd_port = items[0].remoteDeviceProduction.device_port;

        return {
            remote_device: rd_ip +":"+ rd_port,
            prepare_time: parseInt(prepare_time, 10)
        };
    }).reverse();

    // clear remote device order list...
    var rds_order_list = [];
    for (let i = 0; i < pt.length; i++) {
        var can_add = true;
        for (let x = 0; x < rds_order_list.length; x++) {
            if(rds_order_list[x].remote_device == pt[i].remote_device){
                can_add = false;
            }
        }
        if(can_add) {
            rds_order_list.push(pt[i]);
        }
    }
    
    var timer_incial = -1;
    var timer_maximum = rds_order_list[0].prepare_time;
    var qtd_rd_sended = 0;
    var timer_loop = setInterval(function() {
        timer_incial++;
        
        // looping for remote devices to send account payload...
        rds_order_list.forEach(rd => {
            var time_to_show = (timer_maximum - rd.prepare_time);
            if(time_to_show == timer_incial) {
                console.log('sending to '+ rd.remote_device);
                qtd_rd_sended++;

                // get remote device specified items...
                account.items = rds[rd.remote_device];

                var device_ip = rd.remote_device.split(':')[0];
                var device_port = Number(rd.remote_device.split(':')[1]);

                sendSocketMessage(device_ip, device_port, account);
            }
        });

        if(qtd_rd_sended == rds_order_list.length)
            clearInterval(timer_loop);
    }, 1000);
    
    res.status(201);
    res.send();
}

// Create account
router.post('/', async function(req, res, next) {
    if(Object.keys(req.body).length > 0){
        RemoteDevice.findAll({}).then(rds => {
            if(rds != null && rds.length > 0) {
                var account = new Account();
                    account.pid         = req.body.pid;
                    account.type        = req.body.type;
                    account.number      = req.body.number;
                    account.status_code = 0; // every starts with 0 (pending production...)

                    rds.forEach(rd => {
                        // obtain id of conference remote device...
                        if(rd.pid == req.body.remote_device_conference.pid) {
                            account.remote_device_conference_id = rd.id;
                        }
                    });

                    account.save().then(aSaved => {
                        if(req.body.items != null && req.body.items.length > 0) {
                            var cont = 0;
                            req.body.items.forEach(item => {
                                var accountItem = new AccountItem();
                                    accountItem.pid 			= item.pid;
                                    accountItem.account_id      = account.id;
                                    accountItem.name 			= item.name;
                                    accountItem.quantity 		= item.quantity;
                                    accountItem.prepare_time 	= item.prepare_time;
                                    accountItem.combo_name 		= item.combo_name;
                                    accountItem.status_code 	= 0; // every starts with 0 (pending production...)
        
                                rds.forEach(rd => {
                                    // obtain id of production remote device...
                                    if(rd.pid == item.remote_device_production.pid) {
                                        accountItem.remote_device_production_id = rd.id;
                                    }
                                });

                                if(item.aditionals != null && item.aditionals.length > 0) {
                                    accountItem.save().then(iSaved => {
                                        item.aditionals.forEach(aditional => {
                                            var accountItemAditional = new AccountItemAditional();
                                                accountItemAditional.name = aditional.name;
                                                accountItemAditional.account_item_id = accountItem.id;
                                                accountItemAditional.save();
                                        });

                                        cont++;

                                        if(cont == req.body.items.length)
                                            sendResponse(res, aSaved);
                                    });
                                }
                                else {
                                    accountItem.save();

                                    cont++;
                                    
                                    if(cont == req.body.items.length)
                                        sendResponse(res, aSaved);
                                }
                            });
                        }
                    });
            }
            else {
                res.status(406);
                res.send('Nenhum dispositivo remoto associado!');
            }
        });
    }
    else {
        res.status(406);
        res.send('Nenhuma informação foi encontrada no corpo da requisição');
    }
});

// List accounts
router.get('/', function(req, res, next) {
  	Account.findAll({}).then(items => {
		if(items.length > 0) {
            res.json(items);
        }
        else {
            res.status(404);
            res.send('');
        }
	});
});

// Get account data by id
router.get('/:account_id', function(req, res, next) {
    Account.findById(req.params.account_id).then(item => {
        res.json(item);
    });
});

// Get account items
router.get('/:account_id/items', function(req, res, next) {
    AccountItem.findAll({
        where: {
            account_id: req.params.account_id
        }
    }).then(items => {
      if(items.length > 0) {
          res.json(items);
      }
      else {
          res.status(404);
          res.send('');
      }
  });
});

// Get account items not completed
async function sendItemsNotCompletedResponse(res, accounts) {
    for(var i = 0; i < accounts.length; i++) {
        accounts[i].items = await AccountItem.findAll({
            where: {
                account_id: accounts[i].id,
                status_code: {
                    [Op.ne]: 2
                }
            }
        });
        
        for(var x = 0; x < accounts[i].items.length; x++) {
            accounts[i].items[x].aditionals = await AccountItemAditional.findAll({
                where: {
                    account_item_id: accounts[i].items[x].id
                }
            });
        }
    }

    res.json(accounts);
}

router.get('/items/notcompleted', function(req, res, next){
    var sqlQuery  = "SELECT acc.* ";
        sqlQuery += "FROM tbl_account_items        AS tai ";
        sqlQuery += "INNER JOIN tbl_accounts       AS acc ON acc.id = tai.account_id ";
        sqlQuery += "INNER JOIN tbl_remote_devices AS trd ON trd.id = tai.remote_device_production_id ";
        sqlQuery += "WHERE tai.status_code <> 2 ";
        sqlQuery += "   AND trd.id = '"+ req.query.remote_device_id +"' ";
        sqlQuery += "GROUP BY acc.id";
    
    models.sequelize.query(sqlQuery).then(results => {
            if(results[0].length > 0) {
                sendItemsNotCompletedResponse(res, results[0]);
            }
            else {
                res.status(404);
                res.send('');
            }
        });
});

// Get account items completed
async function sendItemsCompletedResponse(res, accounts) {
    for(var i = 0; i < accounts.length; i++) {
        accounts[i].items = await AccountItem.findAll({
            where: {
                account_id: accounts[i].id,
                finishedAt: {
                    [Op.ne]: null
                },
                sync: 0
            }
        });
        
        for(var x = 0; x < accounts[i].items.length; x++) {
            accounts[i].items[x].aditionals = await AccountItemAditional.findAll({
                where: {
                    account_item_id: accounts[i].items[x].id
                }
            });
        }

        res.json(accounts);
    }
}

router.get('/items/completed', function(req, res, next) {
    var sqlQuery =  "SELECT act.* ";
        sqlQuery += "FROM tbl_accounts AS act ";
        sqlQuery += "INNER JOIN tbl_account_items AS itm ON itm.account_id = act.id ";
        sqlQuery += "WHERE itm.finishedAt IS NOT NULL ";
        sqlQuery += "   AND itm.sync = 0 ";
        sqlQuery += "GROUP BY act.id";
    
    models.sequelize.query(sqlQuery).then(results => {
        if(results[0].length > 0) {
            sendItemsCompletedResponse(res, results[0]);
        }
        else {
            res.status(404);
            res.send('');
        }
    });
});

// Check syncronized items
router.put('/items/sync', function(req, res, next) {
    req.body.forEach(account => {
        account.items.forEach(account_item => {
            if(account_item.sync) {
                AccountItem.findById(account_item.id).then(item => {
                    if(item != null) {
                        item.update({
                            sync: true
                        }).then(model => {
                            res.status(200);
                            res.send();
                        });
                    }
                    else {
                        res.status(406);
                        res.send('Nenhum item encontrado com o pid: '+ account_item.pid);
                    }
                });
            }
        });
    });
});

async function sendRemoteDeviceConferenceUpdate(account_id, item_data) {
    var account = await Account.findById(account_id);
    var account_data = account.dataValues;
        account_data.remoteDeviceConference = await RemoteDevice.findById(account.remote_device_conference_id);
        account_data.items = [];
        account_data.items.push(item_data);
    
    sendSocketMessage(
        account_data.remoteDeviceConference.device_ip, 
        account_data.remoteDeviceConference.device_port, 
        account_data
    );
}

// Check begining item preparation
router.put('/:account_id/items/:account_item_id/begin', function(req, res, next) {
    AccountItem.findById(req.params.account_item_id).then(item => {
        switch(item.status_code) {
            case 0: // preparo pendente
                item.update({
                    startedAt: new Date(),
                    status_code: 1
                }).then(item_model => {
                    sendRemoteDeviceConferenceUpdate(req.params.account_id, item_model.dataValues);

                    res.status(200);
                    res.send();
                });
                break;
            case 1: // preparo iniciado
                res.status(406);
                res.send('O preparo do item informado já foi iniciado!');
                break;
            case 2: // preparo finalizado
                res.status(406);
                res.send('O preparo do item informado já foi finalizado!');
                break;
        }
    });
});

// Check ending item preparation
router.put('/:account_id/items/:account_item_id/end', function(req, res, next) {
    AccountItem.findById(req.params.account_item_id).then(item => {
        switch(item.status_code) {
            case 0: // preparo pendente
                res.status(406);
                res.send('O preparo do item informado ainda não foi iniciado!');
                break;
            case 1: // preparo iniciado
                item.update({
                    finishedAt: new Date(),
                    status_code: 2
                }).then(model => {
                    sendRemoteDeviceConferenceUpdate(req.params.account_id, item_model.dataValues);
                    res.status(200);
                    res.send();
                });
                break;
            case 2: // preparo finalizado
                res.status(406);
                res.send('O preparo do item informado já foi finalizado!');
                break;
        }
    });
});

// Get account item aditionals
router.get('/:account_id/items/:account_item_id/aditionals', function(req, res, next) {
    AccountItemAditional.findAll({
        where: {
            account_item_id: req.params.account_item_id
        }
    }).then(items => {
      if(items.length > 0) {
          res.json(items);
      }
      else {
          res.status(404);
          res.send('');
      }
  });
});

module.exports = router;