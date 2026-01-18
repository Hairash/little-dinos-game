<!-- Component for login page -->
<template>
  <div id="login-page">
    <button type="button" class="goBackBtn" @click="handleBackBtnClick" title="Back to Menu">
      <img :src="`/images/arrow_white.png`">
    </button>
    <h1 id="login-page-title">{{ isSignUp ? 'Sign Up' : 'Login' }}</h1>
    <div id="login-page-toggle">
      <button 
        id="login-page-toggle-button" 
        :class="{ active: !isSignUp }"
        @click="isSignUp = false"
      >
        Login
      </button>
      <button 
        id="login-page-toggle-button" 
        :class="{ active: isSignUp }"
        @click="isSignUp = true"
      >
        Sign Up
      </button>
    </div>
    <form @submit.prevent="handleSubmit">
      <div id="login-page-form-item">
        <label for="username">Username</label>
        <input type="text" id="username" v-model="username" required />
      </div>
      <div id="login-page-form-item">
        <label for="password">Password</label>
        <input type="password" id="password" v-model="password" required />
      </div>
      <button id="login-page-form-button" type="submit">
        {{ isSignUp ? 'Sign Up' : 'Login' }}
      </button>
      <p id="login-page-form-error" v-if="error">{{ error }}</p>
    </form>
  </div>
</template>

<script>
import { signin, signup } from '@/auth';
import emitter from "@/game/eventBus";
import { GAME_STATES } from "@/game/const";

export default {
  name: 'LoginPage',
  data() {
    return {
      username: '',
      password: '',
      error: null,
      isSignUp: false,
    }
  },
  methods: {
    async handleSubmit() {
      try {
        this.error = null;
        let response;
        if (this.isSignUp) {
          response = await signup(this.username, this.password);
        } else {
          response = await signin(this.username, this.password);
        }
        console.log(response);
        this.$emit('loginSuccess', response);
        this.error = null;
      } catch (error) {
        this.error = error.message;
        this.$emit('loginError', error.message);
      }
    },
    handleBackBtnClick() {
      emitter.emit('goToPage', GAME_STATES.menu);
    }
  }
}
</script>

<style>
#login-page {
  position: relative;
  background-image: url('/images/background.png');
  background-size: cover;
  width: 100vw;
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.goBackBtn {
  position: absolute;
  top: 34px;
  left: 16px;
  border: none;
  background-color: rgba(0, 0, 0, 0);
  z-index: 10;
}

.goBackBtn img {
  width: 40px;
  height: 40px;
  user-select: none;
  cursor: pointer;
}

#login-page-title {
  color: white;
  font-size: 48px;
  margin-bottom: 20px;
}

#login-page-toggle {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
}

#login-page-toggle-button {
  padding: 8px 20px;
  background-color: #222222;
  color: #ffffff;
  border: 2px solid #d8a67e;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.3s;
}

#login-page-toggle-button:hover {
  background-color: #333333;
}

#login-page-toggle-button.active {
  background-color: #d8a67e;
  color: #001111;
}

#login-page-toggle-button.active:hover {
  background-color: #ae7b62;
}

#login-page-form-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  width: 100%;
  max-width: 300px;
}

#login-page-form-item label {
  color: #ffffff;
  margin-bottom: 8px;
  font-size: 14px;
  align-self: flex-start;
}

#login-page-form-item input {
  width: 100%;
  padding: 10px;
  border: 2px solid #d8a67e;
  border-radius: 4px;
  background-color: #001111;
  color: #ffffff;
  font-size: 16px;
}

#login-page-form-item input:focus {
  outline: none;
  border-color: #ae7b62;
}

#login-page-form-item input::placeholder {
  color: #888888;
}

#login-page-form-button {
  padding: 12px 30px;
  background-color: #d8a67e;
  color: #001111;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: background-color 0.3s;
  margin-top: 10px;
}

#login-page-form-button:hover {
  background-color: #ae7b62;
}

#login-page-form-button:active {
  background-color: #926846;
}

#login-page-form-error {
  color: #ff6b6b;
  margin-top: 15px;
  font-size: 14px;
  text-align: center;
}
</style>