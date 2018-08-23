'use strict';
module.exports = (sequelize, DataTypes) => {
  var AccountItem = sequelize.define('AccountItem', {
    pid: DataTypes.INTEGER,
    account_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    quantity: DataTypes.INTEGER,
    prepare_time: DataTypes.INTEGER,
    combo_name: DataTypes.STRING,
    status_code: DataTypes.INTEGER,
    remote_device_production_id: DataTypes.INTEGER,
    remote_device_conference_id: DataTypes.INTEGER,
    startedAt: DataTypes.DATE,
    finishedAt: DataTypes.DATE,
    sync: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    createdAt: false,
    updatedAt: false,
    paranoid: true,
    tableName: 'tbl_account_items'
  });
  AccountItem.associate = function(models) {
    AccountItem.belongsTo(models.Account, {
      onDelete: "CASCADE",
      foreignKey: 'account_id'
    });
    
    AccountItem.belongsTo(models.RemoteDevice, {
      onDelete: "CASCADE",
      foreignKey: 'remote_device_production_id'
    });

    AccountItem.belongsTo(models.RemoteDevice, {
      onDelete: "CASCADE",
      foreignKey: 'remote_device_conference_id'
    });

    AccountItem.hasMany(models.AccountItemAditional, {
      foreignKey: 'account_item_id'
    });
  };
  return AccountItem;
};