'use strict';
module.exports = (sequelize, DataTypes) => {
  
  var Account = sequelize.define('Account', {
    pid: DataTypes.INTEGER,
    name: DataTypes.STRING,
    number: DataTypes.INTEGER,
    status_code: DataTypes.INTEGER,
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
  };

  Account.getFullData = function() {
    console.log(this, sequelize);
  }

  return Account;
};