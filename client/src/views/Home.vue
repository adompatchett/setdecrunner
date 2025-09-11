<template>
  <div>
    <h1>Welcome to SetDecRunner</h1>
    <p>Digital run sheets for film set decoration.</p>
    <button v-if="!auth.user" @click="$router.push('/login')">Sign Up / Login</button>
    <button v-if="auth.user" @click="$router.push('/create-production')">Create a Production</button>
    <!-- Sales content: features, pricing, etc. -->
    <section>
      <h2>Features</h2>
      <ul>
        <li>Manage run sheets, sets, suppliers, and more</li>
        <li>Collaborate with your film crew</li>
        <li>Secure, production-specific dashboards</li>
      </ul>
      <h2>Pricing</h2>
      <p>Subscribe for $X/month per production. <a href="/signup">Get Started</a></p>
    </section>
  </div>
</template>

<script>
import { useAuth } from '../auth';

export default {
  name: 'Home',
  setup() {
    const auth = useAuth();
    return { auth };
  },
};
</script>