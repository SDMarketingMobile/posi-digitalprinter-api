'use strict';
module.exports = (sequelize, DataTypes) => {
  
  var Account = sequelize.define('Account', {
    pid: DataTypes.INTEGER,
    type: DataTypes.INTEGER,
    number: DataTypes.INTEGER,
    status_code: DataTypes.INTEGER,
    remote_device_conference_id: DataTypes.INTEGER,
    finishedAt: DataTypes.DATE
  }, {
    updatedAt: false,
    paranoid: true,
    tableName: 'tbl_accounts'
  });

  Account.associate = function(models) {
    Account.hasMany(models.AccountItem, {
      foreignKey: 'account_id'
    });

    Account.belongsTo(models.RemoteDevice, {
      onDelete: "CASCADE",
      foreignKey: 'remote_device_conference_id'
    });
  };

  Account.getFullData = function() {
    console.log(this, sequelize);
  }

  return Account;
};