/**
 * Mail Provider Factory (Serverless version)
 */
import { MailTmProvider } from './mail-tm';
import { GuerrillaMailProvider } from './guerrilla-mail';

export function createMailProvider(providerName = 'mail_tm') {
  switch (providerName.toLowerCase()) {
    case 'mail_tm':
    case 'mailtm':
      return new MailTmProvider();
    case 'guerrilla':
    case 'guerrillamail':
      return new GuerrillaMailProvider();
    default:
      return new MailTmProvider();
  }
}

export { MailTmProvider, GuerrillaMailProvider };
