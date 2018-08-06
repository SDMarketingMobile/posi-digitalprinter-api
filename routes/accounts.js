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

async function sendResponse (res, account) {
    // retrieve account all items...
    var items = await account.getAccountItems();

    account = account.dataValues;

    // looping for items to...
    for(var i = 0; i < items.length; i++) {
        // get aditionals...
        var aditionals = await items[i].getAccountItemAditionals();
        
        // production remote device info...
        var remote_device_production_id = items[i].remote_device_production_id
        var remoteDeviceProduction = await RemoteDevice.findById(remote_device_production_id);

        // and conference remote device info...
        var remote_device_conference_id = items[i].remote_device_conference_id
        var remoteDeviceConference = await RemoteDevice.findById(remote_device_conference_id);

        items[i] = items[i].dataValues;

        items[i].aditionals = aditionals;
        items[i].remoteDeviceProduction = remoteDeviceProduction;
        items[i].remoteDeviceConference = remoteDeviceConference;
    }
    
    // identifying remote devices to send account...
    var rds = underscore.groupBy(items, function(item){
        var ip = item.remoteDeviceProduction.device_ip;
        var port = item.remoteDeviceProduction.device_port;
        return ip +":"+ port;
    });

    // looping for remote devices to send account payload...
    underscore.keys(rds).forEach(rd_name => {
        // get remote device specified items...
        account.items = rds[rd_name];

        // send payload to specific remote device with websocket connection...
        var client = new net.Socket();

        var device_ip = rd_name.split(':')[0];
        var device_port = Number(rd_name.split(':')[1]);

        client.connect(device_port, device_ip, function() {
            console.log('CONNECTED TO: '+ device_ip +':'+ device_port);
            client.write(JSON.stringify(account));
        });
        client.on('data', function(data){
            console.log('DATA RECEIVED: '+ data);
            client.destroy();
        });

        client.on('close', function(){
            console.log('CONNECTION CLOSED TO: '+ device_ip +':'+ device_port);
        });

        client.on('error', function(){
            console.log('CONNECTION ERROR TO: '+ device_ip +':'+ device_port);
        });
    });
    
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
                    account.name        = req.body.name;
                    account.number      = req.body.number;
                    account.status_code = 0; // every starts with 0 (pending production...)
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

                                    // obtain id of conference remote device...
                                    if(rd.pid == item.remote_device_conference.pid) {
                                        accountItem.remote_device_conference_id = rd.id;
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

// Check begining item preparation
router.put('/:account_id/items/:account_item_id/begin', function(req, res, next) {
    AccountItem.findById(req.params.account_item_id).then(item => {
        switch(item.status_code) {
            case 0: // preparo pendente
                item.update({
                    startedAt: new Date(),
                    status_code: 1
                }).then(model => {
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