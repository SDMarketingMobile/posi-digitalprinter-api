var express = require('express');
var net 	 = require('net');
var router = express.Router();
var models 	= require('../models');
var Sequelize = require('sequelize');
var Op = Sequelize.Op;
var RemoteDevice = models.RemoteDevice;

// List all remote devices
router.get('/', function(req, res, next) {
  	RemoteDevice.findAll({}).then(items => {
		if(items.length > 0) {
            res.json(items);
        }
        else {
            res.status(404);
            res.send('');
        }
	});
});

// Test conectivity with remote devices
router.get('/test/conection', function(req, res, nex) {
	res.send();
});

// Charge database with remote devices data
router.post('/reload', function(req, res, next) {
	RemoteDevice.destroy({
		truncate: true
	});

	var remoteDevices = req.body;
	for(var i = 0; i < remoteDevices.length; i++) {
		var rd = new RemoteDevice();
			rd.pid 			= remoteDevices[i].id;
			rd.name 		= remoteDevices[i].name;
			rd.device_ip 	= remoteDevices[i].device_ip;
			rd.device_port 	= remoteDevices[i].device_port;
			rd.mestra_ip 	= remoteDevices[i].mestra_ip;
			rd.mestra_port 	= remoteDevices[i].mestra_port;
			rd.view_mode 	= remoteDevices[i].view_mode;
			rd.save();
	}

	res.status(201);
	res.send('');
});

// Link remote device with IP <> WebSocket ID
router.put('/reference/ip', function(req, res, next){
	RemoteDevice.findOne({
		where: {
			device_ip: req.body.device_ip
		}
	}).then(item => {
		if(item != null) {
			item.update({
				websocket_id: req.body.websocket_id
			}).then(model => {
				res.status(200);
				res.json(model);
			});
		}
		else {
			res.status(404);
			res.send('Nenhum item encontrado com o ip: '+ req.body.device_ip);
		}
	});
});

module.exports = router;