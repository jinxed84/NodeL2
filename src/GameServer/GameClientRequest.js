module.exports = {
         addShortcut: invoke('GameServer/Request/AddShortcut'),
              action: invoke('GameServer/Request/Action'),
           actionUse: invoke('GameServer/Request/ActionUse'),
              attack: invoke('GameServer/Request/Attack'),
      authorizeLogin: invoke('GameServer/Request/AuthorizeLogin'),
          charCreate: invoke('GameServer/Request/CharCreate'),
        charSelected: invoke('GameServer/Request/CharSelected'),
          enterWorld: invoke('GameServer/Request/EnterWorld'),
              logout: invoke('GameServer/Request/Logout'),
      moveToLocation: invoke('GameServer/Request/MoveToLocation'),
        newCharacter: invoke('GameServer/Request/NewCharacter'),
     protocolVersion: invoke('GameServer/Request/ProtocolVersion'),
           questList: invoke('GameServer/Request/QuestList'),
             restart: invoke('GameServer/Request/Restart'),
                 say: invoke('GameServer/Request/Say'),
           showBoard: invoke('GameServer/Request/ShowBoard'),
       showInventory: invoke('GameServer/Request/ShowInventory'),
        socialAction: invoke('GameServer/Request/SocialAction'),
            stopMove: invoke('GameServer/Request/StopMove'),
        targetCancel: invoke('GameServer/Request/TargetCancel'),
         unequipItem: invoke('GameServer/Request/UnequipItem'),
             useItem: invoke('GameServer/Request/UseItem'),
    validatePosition: invoke('GameServer/Request/ValidatePosition')
};
