<template>
  <div style="text-align:left; padding: 20px">
    <div v-if="isUnlocked">
      <h1>
        Notarize document
      </h1><br>
      <b-field label="Select folder">
        <model-select :options="options" v-model="selected" placeholder="Select folder"></model-select>
      </b-field>
      <b-field label="Select file visibility">
        <model-select :options="options_visibility" v-model="visibility" placeholder="Select file visibility"></model-select>
      </b-field>
      <b-field label="Insert title">
        <b-input v-model="title"></b-input>
      </b-field>
      <div v-if="!fileHash">
        <b-upload v-model="file" v-if="!fileHash && selected" v-on:input="loadFile" drag-drop>
          <section class="section">
            <div class="content has-text-centered">
              <p>Release file here o click to select from computer.</p>
            </div>
          </section>
        </b-upload>
      </div>
      <div v-if="fileHash" style="padding:20px; text-align:center;">
        File hash is: <b>{{ fileHash }}</b>
      </div>
      <b-button v-on:click="writeData" v-if="fileHash && !isWriting && !isUploading" type="is-primary" expanded size="is-large">WRITE DOCUMENT</b-button>
      <div v-if="isWriting" style="padding:20px; text-align:center;">Writing document in the blockchain..</div>
    </div>
    <div v-if="!isUnlocked" style="padding:20vh 0; text-align:center;">
      Unlock your wallet first.<br><br>
      <b-button v-on:click="loadDbfromSpace" type="is-primary">UNLOCK</b-button>
    </div>
  </div>
</template>

<script>
  let ScryptaCore = require("@scrypta/core");
  const aws = require('aws-sdk')
  import { ModelSelect } from 'vue-search-select'
  const crypto = require('crypto')
  const LZUTF8 = require('lzutf8')

  export default {
    components: {
      ModelSelect
    },
    data() {
      return {
        scrypta: new ScryptaCore(true),
        address: "",
        wallet: "",
        selected: "",
        isLogging: true,
        fileHash: "",
        digitalocean: {},
        title: "",
        file: [],
        isUnlocked: false,
        isWriting: false,
        db: [],
        options: [],
        visibility: 'public',
        options_visibility: [
          {
            value: 'public',
            text: 'Public'
          },
          {
            value: 'encrypted',
            text: 'Encrypted'
          }
        ],
        isUploading: false,
        isUpdating: false
      };
    },
    async mounted() {
      const app = this;
      app.wallet = await app.scrypta.importBrowserSID();
      app.wallet = await app.scrypta.returnDefaultIdentity();
      app.scrypta.staticnodes = true
      if (app.wallet.length > 0) {
        let SIDS = app.wallet.split(":");
        app.address = SIDS[0];
        let identity = await app.scrypta.returnIdentity(app.address);
        app.wallet = identity;
        app.isLogging = false
        app.loadDbfromSpace()
      } else {
        app.isLogging = false;
      }
    },
    methods: {
      loadDbfromSpace() {
        const app = this
        app.$buefy.dialog.prompt({
            message: `Enter wallet password`,
            inputAttrs: {
              type: "password"
            },
            trapFocus: true,
            onConfirm: async password => {
              let key = await app.scrypta.readKey(password, app.wallet.wallet);
              if (key !== false) {
                aws.config.update({
                  accessKeyId: key.do.key_id,
                  secretAccessKey: key.do.key_secret
                })
                app.isUnlocked = true
                app.digitalocean = key.do
                const spacesEndpoint = new aws.Endpoint(key.do.endpoint)
                const s3 = new aws.S3({
                  endpoint: spacesEndpoint
                })
                s3.getObject({Bucket: key.do.space, Key: 'scryptaregister/' + app.address + '.db'}, async function(err, data) {
                  if(!err){
                    let db = new Buffer.from(data.Body).toString()
                    let decrypted = await app.scrypta.decryptData(db, key.prv)
                    if(decrypted !== false){
                      app.db = JSON.parse(decrypted)
                      for(let k in app.db){
                        app.options.push({
                          value: k, 
                          text: app.db[k].identifier
                        })
                      }
                    }else{
                      app.$buefy.toast.open({
                        message: "Wrong wallet!",
                        type: "is-danger"
                      });
                    }
                  }
                });
              } else {
                app.$buefy.toast.open({
                  message: "Wrong password!",
                  type: "is-danger"
                })
                location.reload()
              }
            }
          });
      },
      async loadFile() {
        const app = this;
        const file = app.file;

        const spacesEndpoint = new aws.Endpoint(app.digitalocean.endpoint);
        const s3 = new aws.S3({
            endpoint: spacesEndpoint
        })

        app.isUploading = true
        const reader = new FileReader()
        reader.onload = async function () {
          var buf = Buffer(reader.result)
          let hash = crypto.createHash("sha256").update(buf).digest("hex")
          app.fileHash = hash
          let hasError = false
          if(app.visibility === 'encrypted'){
            let wallet = await app.scrypta.readKey(app.db[app.selected].pin, app.db[app.selected].sid)
            let encrypted = await app.scrypta.cryptFile(file, wallet.prv)
            let decrypted = await app.scrypta.decryptFile(encrypted, wallet.prv)
            if(decrypted !== false){
              buf = Buffer(encrypted)
            }else{
              app.$buefy.toast.open({
                message: "Something goes wrong with encryption, please retry.",
                type: "is-danger"
              })
              hasError = true
            }
          }
          if(!hasError){
            s3.upload({
                Bucket: app.digitalocean.space,
                ACL: 'public-read',
                Body: buf,
                Key:  'scryptaregister/' + app.db[app.selected].address + '/' + hash
            }, { Bucket: app.digitalocean.space }, function (err) {
                app.isUploading = false
                if(!err){
                  app.$buefy.toast.open({
                    message: "File uploaded correctly to space.",
                    type: "is-success"
                  })
                }else{
                  app.$buefy.toast.open({
                    message: "Something goes wrong with upload, please retry.",
                    type: "is-danger"
                  })
                }
            })
          }
        };

        reader.readAsArrayBuffer(file)
      },
      async writeData(){
        const app = this
        if(app.fileHash !== '' && app.selected !== ''){
           app.$buefy.dialog.prompt({
            message: `Insert wallet password`,
            inputAttrs: {
              type: "password"
            },
            trapFocus: true,
            onConfirm: async password => {
              let key = await app.scrypta.readKey(password, app.wallet.wallet)
              if (key !== false) {
                app.isWriting = true
                
                let balance = await app.scrypta.get('/balance/' + app.wallet.address)
                if(balance.balance >= 0.002){
                  let funded = false
                  while(funded === false){
                    let sent = await app.scrypta.send(app.wallet.wallet, password, app.db[app.selected].address, 0.002) 
                    if(sent !== false && sent !== null && sent.length > 1){
                      funded = true
                    }
                  }
                  if(funded === true){
                    let title = app.title
                    if(title !== ''){
                      title = LZUTF8.compress(title, { outputEncoding: 'Base64' })
                    }
                    let FileData = JSON.stringify({
                      file: app.fileHash,
                      title: title,
                      timestamp: new Date().getTime(),
                      visibility: app.visibility
                    })

                    let signature = await app.scrypta.signMessage(key.prv, FileData)
                    let dataToWrite = JSON.stringify(signature)
                    let success = false
                    let written
                    while(success === false){
                      written = await app.scrypta.write(app.db[app.selected].sid, app.db[app.selected].pin, dataToWrite, app.digitalocean.space+'.'+app.digitalocean.endpoint, '', 'register://')
                      if (written.txs.length >= 1 && written.txs[0] !== null) {
                        success = true
                        app.$buefy.toast.open({
                          message: "Data written correctly!",
                          type: "is-success"
                        })
                        app.created = true
                        app.isWriting = false
                        app.selected = ''
                        app.fileHash = ''
                        app.title = ''
                        app.file = []
                      }
                    }
                  }else{
                    app.$buefy.toast.open({
                      message: "There's something wrong with the funding operation, please retry.",
                      type: "is-danger"
                    })
                  }
                }else{
                  app.$buefy.toast.open({
                    message: "Not enough balance, please fund your address.",
                    type: "is-danger"
                  })
                  app.isWriting = false
                }
              }else{
                app.$buefy.toast.open({
                  message: "Wrong password!",
                  type: "is-danger"
                })
              }
            }
          })
        }else{
          app.$buefy.toast.open({
            message: "Please write the informations first.",
            type: "is-danger"
          })
        }
      }
    }
  };
</script>
