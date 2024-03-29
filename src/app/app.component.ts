import { Component } from "@angular/core";

import { Platform, ToastController } from "@ionic/angular";
import { SplashScreen } from "@ionic-native/splash-screen/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { CriteriaValidators } from "./criteria-validators";
import { CriteriaUsageState, isUsable } from "./criteria-usage-state.enum";
import {
  lowerCaseCharacters,
  upperCaseCharacters,
  numberCharacters,
  doesStringContainTypes,
} from "./characters.util";
import { TranslateService } from "@ngx-translate/core";
import {
  find,
  distinct,
  take,
  map,
  filter,
  combineOperators,
  reduce,
} from "collection-ops";

@Component({
  selector: "app-root",
  styleUrls: ["app.component.scss"],
  templateUrl: "app.component.html",
})
export class AppComponent {
  readonly outputPlaceholder: string = "Generate Password";
  readonly defaultSpecialCharacters = "-_@!$?";

  public output: string = this.outputPlaceholder;

  criteriaForm = new FormGroup(
    {
      length: new FormControl(8, [Validators.min(1)]),
      lowerUsage: new FormControl(CriteriaUsageState.CAN_USE),
      upperUsage: new FormControl(CriteriaUsageState.DO_NOT_USE),
      numberUsage: new FormControl(CriteriaUsageState.DO_NOT_USE),
      specialUsage: new FormControl(CriteriaUsageState.DO_NOT_USE),
      specialCharacters: new FormControl(null),
    },
    [
      CriteriaValidators.criteriaTypeValidator,
      CriteriaValidators.criteriaLengthValidator,
    ]
  );

  constructor(
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    private toastController: ToastController,
    private translate: TranslateService
  ) {
    this.initializeApp();

    this.criteriaForm.get("specialUsage").valueChanges.subscribe((state) => {
      const specialCharactersControl =
        this.criteriaForm.get("specialCharacters");
      if (isUsable(state)) {
        specialCharactersControl.enable();
      } else {
        specialCharactersControl.disable();
      }
    });
  }

  private initializeApp(): void {
    this.translate.setDefaultLang("en");
    this.translate.use(this.translate.getBrowserLang());

    this.platform.ready().then(() => {
      this.statusBar.styleDefault();
      this.splashScreen.hide();
    });
  }

  public getNewPassword(): void {
    const lowerState = this.criteriaForm.get("lowerUsage").value;
    const upperState = this.criteriaForm.get("upperUsage").value;
    const numberState = this.criteriaForm.get("numberUsage").value;
    const specialState = this.criteriaForm.get("specialUsage").value;
    const specialCharacters =
      this.criteriaForm.get("specialCharacters").value ||
      this.defaultSpecialCharacters;

    const firstPasswordThatMeetsCriteria = find((newPassword) =>
      doesStringContainTypes(
        newPassword,
        lowerState === CriteriaUsageState.MUST_INCLUDE,
        upperState === CriteriaUsageState.MUST_INCLUDE,
        numberState === CriteriaUsageState.MUST_INCLUDE,
        specialState === CriteriaUsageState.MUST_INCLUDE,
        Array.from(specialCharacters)
      )
    );

    this.output = firstPasswordThatMeetsCriteria(
      this.generatePossiblePasswords()
    );
  }

  public async copyPassword(): Promise<void> {
    // The following cast is to avoid a compilation error with the current version of typescript
    (navigator as any).clipboard.writeText(this.output).then(async () => {
      const copyAlert = await this.toastController.create({
        message: "Password has been copied to the clipboard",
        duration: 2500,
      });
      copyAlert.present();
    });
  }

  private *generatePossiblePasswords() {
    while (true) {
      yield this.generatePassword();
    }
  }

  private generatePassword(): string {
    const lengthOfPassword = this.criteriaForm.get("length").value;
    const validCharacters: string[] = this.determineValidCharacters();
    const filterNumbersThatAreAvailable = filter(
      (number) => number < validCharacters.length
    );
    const takeLengthOfPassword = take(lengthOfPassword);
    const mapNumberToCharacter = map((number) => validCharacters[number]);
    const concatCharacters = reduce((x, y) => x + y)("");

    const getPasswordFromNumbers = combineOperators(
      filterNumbersThatAreAvailable,
      takeLengthOfPassword,
      mapNumberToCharacter
    );

    return concatCharacters(getPasswordFromNumbers(generateRandomNumbers()));
  }

  private determineValidCharacters(): string[] {
    const lowerState = this.criteriaForm.get("lowerUsage").value;
    const upperState = this.criteriaForm.get("upperUsage").value;
    const numberState = this.criteriaForm.get("numberUsage").value;
    const specialState = this.criteriaForm.get("specialUsage").value;
    const specialCharacters =
      this.criteriaForm.get("specialCharacters").value ||
      this.defaultSpecialCharacters;

    let validChars: string[] = [];

    if (isUsable(lowerState)) {
      validChars = validChars.concat(lowerCaseCharacters);
    }

    if (isUsable(upperState)) {
      validChars = validChars.concat(upperCaseCharacters);
    }

    if (isUsable(numberState)) {
      validChars = validChars.concat(numberCharacters);
    }

    if (isUsable(specialState)) {
      const enabledSpecialCharacters =
        specialCharacters || this.defaultSpecialCharacters;
      const specialCharactersToAdd: string[] = Array.from(
        distinct([...enabledSpecialCharacters])
      );
      validChars = validChars.concat(specialCharactersToAdd);
    }

    return validChars;
  }
}

const NUMBER_BUFFER_SIZE = 16;

function* generateRandomNumbers() {
  while (true) {
    const fetchedNumbers = new Uint8Array(NUMBER_BUFFER_SIZE);
    crypto.getRandomValues(fetchedNumbers);
    for (const value of fetchedNumbers) {
      yield value;
    }
  }
}
