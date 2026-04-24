exports.verificationEmail = (name, link) => {
  return `
  <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
    <div style="max-width: 600px; margin: auto; background: white; border-radius: 8px; overflow: hidden;">
      
      <div style="background: linear-gradient(90deg, #06b6d4, #9333ea); padding: 20px; text-align: center;">
        <h2 style="color: white; margin: 0;">LLM Content Planner</h2>
      </div>

      <div style="padding: 30px;">
        <h3 style="margin-top: 0;">Hi ${name}, 👋</h3>
        <p>
          Thanks for signing up! Please confirm your email address by clicking the button below.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}" 
             style="background-color: #4CAF50; 
                    color: white; 
                    padding: 12px 25px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    font-weight: bold;">
            Verify Email
          </a>
        </div>

        <p>
          If you did not create this account, you can safely ignore this email.
        </p>

        <p style="font-size: 12px; color: #777;">
          This link will expire in 24 hours.
        </p>
      </div>

      <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #777;">
        © ${new Date().getFullYear()} LLM Content Planner. All rights reserved.
      </div>

    </div>
  </div>
  `;
};
