const {createApp}=require('./platform/app');
const app=createApp();
app.listen(process.env.PORT||3001,'0.0.0.0',()=>console.log('FA-MINNA Express API started. Live payments disabled.'));
