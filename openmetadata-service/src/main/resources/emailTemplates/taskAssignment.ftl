<!-- [if !mso]>
<!-->
<!--![endif]-->
<!-- Normalize Styles -->
<!-- [if gte mso 9]>
<style type="text/css">
            /* What it does: Normalize space between bullets and text. */
            /* https://litmus.com/community/discussions/1093-bulletproof-lists-using-ul-and-li */
            li {
                text-indent: -1em;
            }
</style>
<![endif]-->
<div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;"> &nbsp; </div>
<table style="background: #F7F8FA; border: 0; border-radius: 0; width: 100%;" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td class="tw-body" style="padding: 15px 15px 0;" align="center">
        <table style="background: #F7F8FA; border: 0; border-radius: 0;" cellspacing="0" cellpadding="0">
          <tbody>
            <tr>
              <td class="" style="width: 600px;" align="center">
                <p style="padding: 5px 5px 5px; font-size: 13px; margin: 0 0 0px; color: #316fea;" align="right"></p>
                <table style="background: #ffffff; border: 0px; border-radius: 4px; width: 99.6672%; overflow: hidden;" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td class="" style="padding: 0px; width: 100%;" align="center">
                        <table style="background: #336f85; border: 0px; border-radius: 0px; width: 599px; height: 53px; margin-left: auto; margin-right: auto;" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td class="tw-card-header" style="padding: 5px 5px px; width: 366px; color: #ffff; text-decoration: none; font-family: sans-serif;" align="center">
                                <span style="font-weight: 600;">Task Notification</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p>
                          <br />
                          <br />
                        </p>
                        <table dir="ltr" style="border: 0; width: 100%;" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td class="tw-card-body" style="padding: 20px 35px; text-align: left; color: #6f6f6f; font-family: sans-serif; border-top: 0;">
                                <h1 class="tw-h1" style="font-size: 24px; font-weight: bold; mso-line-height-rule: exactly; line-height: 32px; margin: 0 0 20px; color: #474747;"> Hello ${assignee},</h1>
                                <p class="" style="margin: 20px 0; font-size: 16px; mso-line-height-rule: exactly; line-height: 24px;">
                                  <span style="font-weight: 400;">${createdBy} have assigned you a task to <#if taskType=="UpdateDescription">
                                      <strong>Update Description </strong>
                                      <#else>
                                        <strong>Update Tags </strong>
                                        </#if>. </span>
                                  <br />
                                <h1 class="tw-h1" style="font-size: 20px; font-weight: bold; mso-line-height-rule: exactly; line-height: 10px; margin: 0 0 10px; color: #474747;"> Task Details :</h1>
                                <br />
                                <span style="font-weight: 400;">
                                  <strong>Task Name :</strong> ${taskName} </span>
                                <br />
                                <span style="font-weight: 400;">
                                  <strong>Task Status :</strong> ${taskStatus} </span>
                                <br />
                                <span style="font-weight: 400;">
                                  <strong>Current Value :</strong> ${fieldOldValue} </span>
                                <br />
                                <span style="font-weight: 400;">
                                  <strong>Suggested Value :</strong> ${fieldNewValue} </span>
                                <br />
                                <br />
                                <br />
                                <span style="font-weight: 400;">
                                  <table class="button mobile-w-full" style="border: 0px; border-radius: 7px; margin: 0px auto; width: 525px; background-color: #008bcb; height: 50px;" cellspacing="0" cellpadding="0" align="center">
                                    <tbody>
                                      <tr>
                                        <td class="button__td " style="border-radius: 7px; text-align: center; width: 523px;">
                                          <!-- [if mso]>
																					<a href="" class="button__a" target="_blank"
                                                                                                         style="border-radius: 4px; color: #FFFFFF; display: block; font-family: sans-serif; font-size: 18px; font-weight: bold; mso-height-rule: exactly; line-height: 1.1; padding: 14px 18px; text-decoration: none; text-transform: none; border: 1px solid #316FEA;"></a>
																					<![endif]-->
                                          <!-- [if !mso]>
																					<!-->
                                          <a class="button__a" style="border-radius: 4px; color: #ffffff; display: block; font-family: sans-serif; font-size: 18px; font-weight: bold; mso-height-rule: exactly; line-height: 1.1; padding: 14px 18px; text-decoration: none; text-transform: none; border: 0;" href="${taskLink}" target="_blank" rel="noopener">View Task</a>
                                          <!--![endif]-->
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                              </td>
                            </tr>
                          </tbody>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>