<template>
  <div id="app">
    <div v-if="!isLogging && wallet">
      <b-navbar>
        <template slot="brand">
          <b-navbar-item tag="router-link" :to="{ path: '/' }">
            <img src="/logo.png" style="margin-right:15px" /> <b>Register Manager</b>
          </b-navbar-item>
        </template>
        
        <template slot="start">
          <b-navbar-item href="/#/">Users</b-navbar-item>
          <b-navbar-item href="/#/notarize">Notarize</b-navbar-item>
        </template>

        <template slot="end">
          <b-navbar-item tag="div">
            <div class="buttons">
              <a v-on:click="logout" class="button is-primary">
                <strong>Logout</strong>
              </a>
            </div>
          </b-navbar-item>
        </template>
      </b-navbar>
      <router-view />
      <hr />Scrypta Blockchain Register Manager<br>Developed by <a href="https://scrypta.foundation" target="_blank">Scrypta Foundation</a>.
      <br />
      <br />
    </div>

    <div v-if="!wallet">
      <section class="hero">
        <div class="hero-body" style="padding: 0;">
          <div class="container" id="create" style="margin-top:50px;">
            <div class="card">
              <div style="padding: 50px 20px;">
                <h1 class="title is-1">Scrypta Blockchain Register Manager</h1>
                <br />
                <h2 class="subtitle">
                  <br />Enter with authorized Scrypta Identity.<br><br>
                  <div id="scrypta-login" dapp="Scrypta Register"></div>
                </h2>
              </div>
            </div>
            <br />Scrypta Blockchain Register Manager<br>Developed by <a href="https://scrypta.foundation" target="_blank">Scrypta Foundation</a>.
            <br />
            <br />
          </div>
        </div>
      </section>
    </div>

    <b-loading :is-full-page="true" :active.sync="isLogging" :can-cancel="false"></b-loading>
  </div>
</template>

<script>
  let ScryptaCore = require("@scrypta/core")
  export default {
    data() {
      return {
        scrypta: new ScryptaCore(true),
        address: "",
        wallet: "",
        isLogging: true,
        file: [],
        isCreating: false,
        isUpdating: false,
        showCreateModal: false,
        password: "",
        passwordrepeat: ""
      };
    },
    async mounted() {
      const app = this;
      app.wallet = await app.scrypta.importBrowserSID();
      app.wallet = await app.scrypta.returnDefaultIdentity();
      if (app.wallet.length > 0) {
        let SIDS = app.wallet.split(":")
        app.address = SIDS[0];
        let identity = await app.scrypta.returnIdentity(app.address);
        app.wallet = identity;
        app.isLogging = false;
      } else {
        app.isLogging = false;
      }
    },
    methods: {
      logout() {
        localStorage.setItem("SID", "");
        location.reload();
      }
    }
  };
</script>

<style>
  #app {
    font-family: "Sen";
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
  }

  #nav {
    padding: 30px;
  }

  #nav a {
    font-weight: bold;
    color: #2c3e50;
  }

  #nav a.router-link-exact-active {
    color: #42b983;
  }
</style>