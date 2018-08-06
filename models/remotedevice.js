'use strict';
module.exports = (sequelize, DataTypes) => {
  var RemoteDevice = sequelize.define('RemoteDevice', {
    pid: DataTypes.INTEGER,
    name: DataTypes.STRING,
    device_ip: DataTypes.STRING,
    device_port: DataTypes.INTEGER,
    mestra_ip: DataTypes.STRING,
    mestra_port: DataTypes.INTEGER,
    websocket_id: DataTypes.STRING,
    view_mode: DataTypes.STRING
  }, {
    updatedAt: false,
    paranoid: true,
    tableName: 'tbl_remote_devices'
  });
  RemoteDevice.associate = function(models) {
    RemoteDevice.hasMany(models.AccountItem, {
      foreignKey: 'remote_device_production_id'
    });

    RemoteDevice.hasMany(models.AccountItem, {
      foreignKey: 'remote_device_conference_id'
    });
  };
  return RemoteDevice;
};