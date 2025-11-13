<!-- Component for login page -->
<template>
  <div id="login-page">
    <h1 id="login-page-title">Login</h1>
    <form @submit.prevent="handleSubmit">
      <div id="login-page-form-item">
        <label for="username">Username</label>
        <input type="text" id="username" v-model="username" required />
      </div>
      <div id="login-page-form-item">
        <label for="password">Password</label>
        <input type="password" id="password" v-model="password" required />
      </div>
      <button id="login-page-form-button" type="submit">Login</button>
      <p id="login-page-form-error" v-if="error">{{ error }}</p>
    </form>
  </div>
</template>

<script>
import { signin } from '@/auth';

export default {
  name: 'LoginPage',
  data() {
    return {
      username: '',
      password: '',
      error: null,
    }
  },
  methods: {
    async handleSubmit() {
      try {
        const response = await signin(this.username, this.password);
        console.log(response);
        this.$emit('loginSuccess', response);
        this.error = null;
      } catch (error) {
        this.error = error.message;
        this.$emit('loginError', error.message);
      }
    }
  }
}
</script>

<style>
#login-page {
  background-image: url('/images/login_background.png');
  width: 100vw;
  height: 100vh;
  overflow: auto;
  background-size: cover;
  background-position: center;
  background-color: #001111;
}

#login-page-title {
  color: white;
  font-size: 48px;
}

#login-page-form-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* height: 100vh; */
}
</style>