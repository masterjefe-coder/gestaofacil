export type SetupSearchParams = {
  evolutionMessage?: string;
  evolutionOk?: string;
  asaasConnected?: string;
  asaasCreated?: string;
  asaasDisconnected?: string;
  asaasError?: string;
  subscriptionUpdated?: string;
  subscriptionCheckoutCreated?: string;
  subscriptionError?: string;
  subscriptionIntent?: string;
  teamCreated?: string;
  inviteCreated?: string;
  inviteRevoked?: string;
  inviteAccepted?: string;
  inviteResent?: string;
  inviteRenewed?: string;
  teamUpdated?: string;
  teamRemoved?: string;
  teamPasswordReset?: string;
  alertPrefsSaved?: string;
  alertPrefsError?: string;
  teamError?: string;
  setupSaved?: string;
  setupError?: string;
};

export type SetupPageFlashState = {
  evolutionMessage?: string;
  evolutionOk: boolean;
  asaasConnected: boolean;
  asaasCreated: boolean;
  asaasDisconnected: boolean;
  asaasError?: string;
  subscriptionUpdated: boolean;
  subscriptionCheckoutCreated: boolean;
  subscriptionError?: string;
  subscriptionIntent: boolean;
  teamCreated: boolean;
  inviteCreated: boolean;
  inviteRevoked: boolean;
  inviteAccepted: boolean;
  inviteResent: boolean;
  inviteRenewed: boolean;
  teamUpdated: boolean;
  teamRemoved: boolean;
  teamPasswordReset: boolean;
  alertPrefsSaved: boolean;
  alertPrefsError?: string;
  teamError?: string;
  setupSaved: boolean;
  setupError?: string;
};

export function readSetupPageFlashState(params?: SetupSearchParams): SetupPageFlashState {
  return {
    evolutionMessage: params?.evolutionMessage,
    evolutionOk: params?.evolutionOk === "1",
    asaasConnected: params?.asaasConnected === "1",
    asaasCreated: params?.asaasCreated === "1",
    asaasDisconnected: params?.asaasDisconnected === "1",
    asaasError: params?.asaasError,
    subscriptionUpdated: params?.subscriptionUpdated === "1",
    subscriptionCheckoutCreated: params?.subscriptionCheckoutCreated === "1",
    subscriptionError: params?.subscriptionError,
    subscriptionIntent: params?.subscriptionIntent === "1",
    teamCreated: params?.teamCreated === "1",
    inviteCreated: params?.inviteCreated === "1",
    inviteRevoked: params?.inviteRevoked === "1",
    inviteAccepted: params?.inviteAccepted === "1",
    inviteResent: params?.inviteResent === "1",
    inviteRenewed: params?.inviteRenewed === "1",
    teamUpdated: params?.teamUpdated === "1",
    teamRemoved: params?.teamRemoved === "1",
    teamPasswordReset: params?.teamPasswordReset === "1",
    alertPrefsSaved: params?.alertPrefsSaved === "1",
    alertPrefsError: params?.alertPrefsError,
    teamError: params?.teamError,
    setupSaved: params?.setupSaved === "1",
    setupError: params?.setupError,
  };
}
