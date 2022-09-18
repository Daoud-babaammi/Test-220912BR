const fs = require("fs");
const { instance: axios } = require("./instance");
const credentails = require("./credentials");

// Initiallizing the tokens
let refresh_token = undefined;
let access_token = undefined;

// Authentification (get refresh token)
const getRefreshToken = async () => {
  await axios
    .post(
      "/login",
      {
        user: credentails.login,
        password: credentails.password,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(
              `${credentails.client_id}:${credentails.client_secret}`
            ).toString("base64"),
        },
      }
    )
    .then((res) => {
      console.log("Authentification is successful!");
      refresh_token = res.data.refresh_token;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

// Get access token

const getAccessToken = async () => {
  await axios
    .post("/token", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    })
    .then((res) => {
      console.log("Getting the access token is successful!");
      access_token = res.data.access_token;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

// Get original accounts

const getAccounts = async (link = "/accounts", accounts = []) => {
  return await axios
    .get(link, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + access_token,
      },
    })
    .then((res) => {
      const newAccounts = res.data.account;

      for (index in newAccounts) {
        const findByAccNumber = (acc) =>
          acc.acc_number === newAccounts[index].acc_number;

        if (!accounts.some(findByAccNumber)) {
          accounts.push(newAccounts[index]);
        }
      }

      if (!res.data.link.next) return accounts;

      return getAccounts(res.data.link.next, accounts);
    })
    .catch((err) => {
      console.log(err.message);
    });
};

//  Get transactions

const getTransactions = async (link = null, transactions = []) => {
  return await axios
    .get(link, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + access_token,
      },
    })
    .then((res) => {
      transactions.push(...res.data.transactions);

      if (!res.data.link.next) return transactions;

      return getTransactions(res.data.link.next, transactions);
    })
    .catch((err) => {
      console.log(`Error in getting transactions : ${link} => ${err.message}`);
    });
};

// Get transactions by account

const getTransactionsbyAccount = async (account) => {
  const transactions =
    (await getTransactions(`/accounts/${account.acc_number}/transactions`)) ||
    [];

  return {
    acc_number: account.acc_number,
    amount: account.amount,
    transactions: transactions.map((t) => {
      return {
        label: t.label,
        amount: t.amount,
        currency: t.currency,
      };
    }),
  };
};

// Main function

const bridgeRun = async () => {
  await getRefreshToken();
  await getAccessToken();
  const accounts = await getAccounts();

  const newlyAccounts = [];

  for (account of accounts) {
    const newAccount = await getTransactionsbyAccount(account);
    newlyAccounts.push(newAccount);
  }

  console.log(JSON.stringify(newlyAccounts, null, 4));
  return newlyAccounts;
};

// Writing the JSON file of the parsed accounts
const writeParsedAccountsFile = (parsedAccounts) => {
  fs.writeFile(
    "parsedAccounts.json",
    JSON.stringify(parsedAccounts, null, 4),
    (err) =>
      err &&
      console.log(
        `Failed to write the JSON file of the parsed Accounts : ${err}`
      )
  );
};

bridgeRun().then(writeParsedAccountsFile);
