# 2023-07-02

* client
    * create routes for random Pokemon and random Pokemon by generation
    * implement simple pixelation algorithm for pixelating sprites
* server
    * create endpoint for getting sprites via proxy
    * create endpoint for getting random Pokemon spcies
<img alt="pixelchu" src="scrots/pixelchu.PNG" width="250"/>

# 2023-07-10

* server
    * create game registry to manage games
    * setup websockets server

# 2023-07-11

* server
    * implement hosting and joining games
    * implement starting and cancelling games

# 2023-07-12

* server
    * designed JSON-based communications protocol

# 2023-07-13 - 2023-07-14

* server
    * overhauled protocol to exclusivly use JSON for all communications
    * create Round class to asynchronously run rounds
    * create Picker class to randomly select Pokemon

# 2023-07-15

* server
    * implement ready method in Round to synchronize players
    * add base64 encoded URLs to QUESTION packets