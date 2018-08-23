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

// Charge database with remote devices data
router.post('/reload', function(req, res, next) {
	RemoteDevice.destroy({
		truncate: true
	});

	var remoteDevices = req.body;
	for(var i = 0; i < remoteDevices.length; i++) {
		if(remoteDevices[i].pid != null && remoteDevices[i].pid != '' && typeof(remoteDevices[i].pid) != 'undefined'){
			var rd = new RemoteDevice();
				rd.pid 			= remoteDevices[i].pid;
				rd.name 		= remoteDevices[i].name;
				rd.device_ip 	= remoteDevices[i].device_ip;
				rd.device_port 	= remoteDevices[i].device_port;
				rd.mestra_ip 	= remoteDevices[i].mestra_ip;
				rd.mestra_port 	= remoteDevices[i].mestra_port;
				rd.save();
		}
		else {
			res.status(406);
			res.send('O campo PID não foi informado!');
			return false;
		}
	}

	res.status(201);
	res.send('');
});

module.exports = router;