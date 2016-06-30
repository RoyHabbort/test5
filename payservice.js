$(function() {
   
    /**
     * вот таким костыльным образом получаем данные от php
     * На деле в файле вьюсы есть js код
     * который заносит всю инфу по услугам в глобальный массив
     * OplataStartConfig
     * 
     * принимая его сюда, мы разбираем этот массив на нужные нам объекты
     * 
     * @type Object
     */
    var services = new function() {
        
        var list = {};
        
        var api = {
            setServices : function(serviceName, service) {
                list[serviceName] = service;
            },
            getService : function(serviceName) {
                return list[serviceName];
            },
            getAll : function() {
                return list;
            }
        }
        
        api.setServices('allocate', OplataStartConfig['allocate']);
        
        for(var key in OplataStartConfig['services']) {
            api.setServices(OplataStartConfig['services'][key].name, OplataStartConfig['services'][key]);
        }
        
        return api;
    }
    
    var currentUser = OplataStartConfig['currentUser'];
    var currentItem = OplataStartConfig['item'];
    var MOVE_DOMAIN = OplataStartConfig['domain'];
   
    /**
     * Объект отвечающий за работу с оплатой
     * @type 
     */
    var oplataObject = new function() {
        
        var api = {
            blocking : false,
            curService : {},
            
            //блокировка, что бы не было 2-х нажатий на купить
            enableBlock : function() {
                api.blocking = true;
            },
            //покупка указанной услуги
            buy : function(serviceName) {
                if (api.blocking) {
                    return false;
                }
                api.enableBlock(); //включаем блокировку от повторной покупки
                
                //получаем пакет, который собрались покупать
                api.curService = services.getService(serviceName);
                //запускаем проверку баланса пользователя
                //она же и определит, какой способ оплаты выбрать далее
                api.checkBallance();
            },
            
            /**
             * Проверяем баланс пользователя. 
             * Делаем по Ajax чтобы избежать конфликтов
             * То есть, баланс пользователя должен быть актуален,
             * а не тот, что был при загрузке страницы
             * 
             * @returns {undefined}
             */
            checkBallance : function() {
                
                var price = api.curService.price;
                
                $.ajax({
                    'url' : '/ajax/PayServiceAjax/checkBalance',
                    'method' : 'POST',
                    'dataType' : 'JSON',
                    'data' : {'price' : price},
                    success : function(resp) {
                        if (resp.status) {
                            
                            if(resp.data.check) {
                                //если баланс позволяет, покупаем с баланса
                                api.buyFromBallance();
                            }
                            else {
                                //иначе с робокассы
                                api.buyFromRobokassa();
                            }
                            
                        }
                        else {
                            alert(resp.message);
                        }
                    },
                    error : function(resp) {
                        alert('Ошибка связи с сервером. Повторите попытку позже');
                        console.log(resp);
                    }
                });
                
            },
            
            /**
             * Производим покупку услуги с баланса пользователя
             * @returns {undefined}
             */
            buyFromBallance : function() {
                //аяксом получаем публичный ключ для покупки
                $.ajax({
                    'url' : '/ajax/PayServiceAjax/createBalanceTransaction',
                    'method' : 'POST',
                    'dataType' : 'JSON',
                    'data' : {'id' : currentItem.id, 'type' : api.curService.name},
                    success : function(resp) {
                        
                        if (resp.status) {
                            
                            if (!resp.data.publicKey) {
                                alert('Ошибка при получении ключа для оплаты');
                                return false;
                            }
                            //отправляем на страницу покупки
                            var url = '//' + MOVE_DOMAIN + '/oplatanew/payFromBallance/' + resp.data.publicKey;
                            document.location.href = url;
                        }
                        else {
                            alert(resp.message);
                        }
                    },
                    error : function(resp) {
                        alert('Ошибка связи с сервером. Повторите попытку позже');
                        console.log(resp);
                    }
                });
                
            },
            
            buyFromRobokassa : function() {
                
                var data = {
                    'title_id' : 1,
                    'comment' : 'Пополнение баланса',
                    'url' : '/user/finance/',
                    'shp_id' : currentItem['id'],
                    'shp_type' : api.curService['name'],
                    'sum' : api.curService['price']
                };
                
                $.ajax({
                    type: 'POST',
                    url: '/user/finance/payment/',
                    data: data,
                    dataType: 'json',
                    success: function (data, status, jqXHR) {
                        window.location.href = data.redirect;
                    },
                    error: function ( jqXHR , textStatus, errorThrown) {
                        console.log(textStatus);
                    }
                });
                
            }
        }
        
        return api;
    }
    
    
    $(document).on('click', '.buy-btn', function() {
        var serviceName = $(this).data('service');
        oplataObject.buy(serviceName);
        
        return false;
    });  
    
});

